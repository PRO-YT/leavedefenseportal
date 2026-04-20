"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  ArrowLeft,
  BellDot,
  CircleCheckBig,
  Mail,
  MapPinned,
  PhoneCall,
  RadioTower,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { firebaseAuth, firebaseDb } from "@/lib/firebase/client";
import { firebaseEnvErrorMessage } from "@/lib/firebase/config";
import {
  type RequestStatus,
  type RequestSocialContacts,
  type SupportRequestDocument,
  type SupportRequestRecord,
} from "@/lib/support-requests";

const DEFAULT_HANDLED_BY = "Logistics Officer Desk";

function sanitizePhone(phone: string | undefined) {
  if (!phone) {
    return "";
  }

  return phone.replace(/[^\d]/g, "");
}

function toDatetimeLabel(value: Timestamp | undefined) {
  if (!value) {
    return "-";
  }

  return value.toDate().toLocaleString();
}

function summarizeNotes(notes: string | undefined) {
  if (!notes?.trim()) {
    return "No operational notes provided.";
  }

  const trimmed = notes.trim();
  if (trimmed.length <= 120) {
    return trimmed;
  }

  return `${trimmed.slice(0, 117)}...`;
}

function getRequesterName(request: SupportRequestRecord) {
  return request.data.requester_name || request.data.member_name || "Unknown requester";
}

function getRequesterRelationship(request: SupportRequestRecord) {
  return request.data.requester_relationship || "Relationship not supplied";
}

function getPrimaryEmail(request: SupportRequestRecord) {
  return (
    request.data.contact?.primary_email ||
    request.data.contact?.alternate_email ||
    request.data.member_email ||
    ""
  );
}

function getPrimaryPhone(request: SupportRequestRecord) {
  return (
    request.data.contact?.primary_phone ||
    request.data.contact?.alternate_phone ||
    request.data.member_phone ||
    ""
  );
}

function getRequestMemberId(request: SupportRequestRecord) {
  return (
    request.data.member_id ||
    request.data.member_service_number ||
    request.data.member_uid ||
    "Member ID not supplied"
  );
}

function getFamilyEmail(request: SupportRequestRecord) {
  return (
    request.data.contact?.primary_email ||
    request.data.contact?.alternate_email ||
    ""
  ).trim();
}

function getFamilyPhone(request: SupportRequestRecord) {
  return (
    request.data.social_contacts?.whatsapp ||
    request.data.contact?.primary_phone ||
    request.data.contact?.alternate_phone ||
    ""
  ).trim();
}

function formatSignalTime(value: Date) {
  return value.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildSignalWindowMemo(
  request: SupportRequestRecord,
  initializedAt: Date,
  expiresAt: Date,
) {
  const memberId = getRequestMemberId(request);
  const rank = request.data.member_rank || "Rank not supplied";
  const familyPhone = getFamilyPhone(request) || "Phone number not supplied";
  const preferredChannel = request.data.contact?.preferred_channel || "Not specified";
  const serviceLane = request.data.request_label ?? request.data.request_type ?? "Support Request";

  return [
    "OFFICIAL SIGNAL PRIORITY NOTICE",
    `Request ID: ${request.id}`,
    `Member ID: ${memberId}`,
    `Rank: ${rank}`,
    `Service Lane: ${serviceLane}`,
    `Urgency: ${(request.data.urgency_level ?? "LOW").toUpperCase()}`,
    `Requester: ${getRequesterName(request)} (${getRequesterRelationship(request)})`,
    `Family Phone Number: ${familyPhone}`,
    `Preferred Contact Channel: ${preferredChannel}`,
    `Signal Timestamp: ${formatSignalTime(initializedAt)}`,
    `Window Expiry: ${formatSignalTime(expiresAt)}`,
    "",
    "This six-hour signal window has been initialized by the logistics officer for official follow-up. Please reply within the active window with availability, confirmation details, and any urgent changes that may affect processing.",
    "",
    "Respectfully,",
    "Logistics Officer Desk",
  ].join("\n");
}

function formatAddress(request: SupportRequestRecord) {
  const address = request.data.requester_address;
  if (!address) {
    return "No home address provided.";
  }

  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country,
  ].filter((value) => (value ?? "").trim() !== "");

  return parts.length > 0 ? parts.join(", ") : "No home address provided.";
}

function toCallLink(request: SupportRequestRecord) {
  const phone = sanitizePhone(getPrimaryPhone(request));
  return phone ? `tel:${phone}` : "";
}

function toWhatsappLink(request: SupportRequestRecord) {
  const raw = request.data.social_contacts?.whatsapp?.trim();

  if (raw) {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      return raw;
    }

    const digits = sanitizePhone(raw);
    if (digits) {
      return `https://wa.me/${digits}`;
    }
  }

  const phone = sanitizePhone(getPrimaryPhone(request));
  if (!phone) {
    return "";
  }

  const text = encodeURIComponent(
    `Official Follow-up: Request ${request.id}\n\n` +
      `Good day ${getRequesterName(request)},\n` +
      `This is the Logistics Officer Desk regarding your ${request.data.request_label ?? request.data.request_type ?? "support"} request.\n` +
      `Current status: ${request.data.status ?? "UNREVIEWED"}.\n` +
      `Please confirm your availability and any mission constraints.\n\n` +
      `Respectfully,\nBastion Logistics Command`,
  );

  return `https://wa.me/${phone}?text=${text}`;
}

function toMailLink(request: SupportRequestRecord) {
  const email = getPrimaryEmail(request);
  if (!email) {
    return "";
  }

  const subject = encodeURIComponent(`Official Follow-up: ${request.id}`);
  const body = encodeURIComponent(
    `Good day ${getRequesterName(request)},\n\n` +
      `This is an official follow-up regarding your ${request.data.request_label ?? request.data.request_type ?? "support"} request (${request.id}).\n` +
      `Current status: ${request.data.status ?? "UNREVIEWED"}.\n\n` +
      `Respectfully,\nBastion Logistics Command`,
  );

  return `mailto:${email}?subject=${subject}&body=${body}`;
}

function toSocialLink(platform: keyof RequestSocialContacts, rawValue: string | undefined) {
  const value = rawValue?.trim();
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  const normalized = value.replace(/^@/, "");

  if (platform === "telegram") {
    return `https://t.me/${normalized}`;
  }
  if (platform === "instagram") {
    return `https://instagram.com/${normalized}`;
  }
  if (platform === "x") {
    return `https://x.com/${normalized}`;
  }
  if (platform === "facebook" && value.includes(".")) {
    return value.startsWith("facebook.com") ? `https://${value}` : `https://${normalized}`;
  }
  if (platform === "whatsapp") {
    const digits = sanitizePhone(value);
    return digits ? `https://wa.me/${digits}` : "";
  }

  return "";
}

function getSocialEntries(request: SupportRequestRecord) {
  const socials = request.data.social_contacts;
  if (!socials) {
    return [];
  }

  const labels: Record<keyof RequestSocialContacts, string> = {
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    signal: "Signal",
    facebook: "Facebook",
    instagram: "Instagram",
    x: "X",
  };

  return (Object.keys(labels) as Array<keyof RequestSocialContacts>)
    .filter((key) => (socials[key] ?? "").trim() !== "")
    .map((key) => ({
      key,
      label: labels[key],
      value: socials[key] as string,
      href: toSocialLink(key, socials[key]),
    }));
}

async function authorizeAdminSession(user: User) {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/admin/authorize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ idToken }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    authorized?: boolean;
    message?: string;
  };

  if (!response.ok || !data.authorized) {
    throw new Error(data.message || "This credential set is not authorized for logistics access.");
  }
}

export default function AdminPage() {
  const firebaseUnavailable = !firebaseAuth || !firebaseDb;
  const [securitySweep, setSecuritySweep] = useState(() => new Date());
  const [authLoading, setAuthLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<SupportRequestRecord[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginStatus, setLoginStatus] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [initializingSignalId, setInitializingSignalId] = useState("");
  const [signalStatus, setSignalStatus] = useState("");

  useEffect(() => {
    const sweepInterval = window.setInterval(() => setSecuritySweep(new Date()), 60_000);
    return () => window.clearInterval(sweepInterval);
  }, []);

  useEffect(() => {
    const auth = firebaseAuth;

    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdminUser(null);
        setAuthLoading(false);
        return;
      }

      setAuthLoading(true);

      try {
        await authorizeAdminSession(user);
        setAdminUser(user);
        setLoginStatus("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setLoginStatus(message);
        setAdminUser(null);
        await signOut(auth);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!adminUser || !firebaseDb) {
      setRequests([]);
      setSelectedRequestId("");
      return;
    }

    const requestsQuery = query(
      collection(firebaseDb, "requests"),
      orderBy("request_timestamp", "desc"),
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const nextData: SupportRequestRecord[] = snapshot.docs.map((document) => {
        return {
          id: document.id,
          data: document.data() as SupportRequestDocument,
        };
      });

      setRequests(nextData);
    });

    return () => unsubscribe();
  }, [adminUser]);

  useEffect(() => {
    if (requests.length === 0) {
      setSelectedRequestId("");
      return;
    }

    const selectedStillExists = requests.some((record) => record.id === selectedRequestId);
    if (!selectedStillExists) {
      setSelectedRequestId(requests[0].id);
    }
  }, [requests, selectedRequestId]);

  const pendingCount = useMemo(() => {
    return requests.filter((record) => (record.data.status ?? "UNREVIEWED") === "UNREVIEWED").length;
  }, [requests]);

  const inProgressCount = useMemo(() => {
    return requests.filter((record) => (record.data.status ?? "UNREVIEWED") === "IN PROGRESS").length;
  }, [requests]);

  const completedCount = useMemo(() => {
    return requests.filter((record) => (record.data.status ?? "UNREVIEWED") === "COMPLETED").length;
  }, [requests]);

  const selectedRequest = useMemo(() => {
    if (requests.length === 0) {
      return null;
    }

    return requests.find((record) => record.id === selectedRequestId) ?? requests[0];
  }, [requests, selectedRequestId]);

  async function handleLogin() {
    if (!firebaseAuth) {
      setLoginStatus(firebaseEnvErrorMessage || "Firebase is not configured.");
      return;
    }

    if (!email.trim() || !password) {
      setLoginStatus("Enter admin email and password.");
      return;
    }

    setLoggingIn(true);
    setLoginStatus("Authenticating...");

    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      setLoginStatus("Verifying access clearance...");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setLoginStatus(`Login failed: ${message}`);
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    if (!firebaseAuth) {
      return;
    }

    await signOut(firebaseAuth);
  }

  async function updateStatus(requestId: string, nextStatus: RequestStatus) {
    if (!firebaseDb) {
      return;
    }

    setUpdatingId(requestId);
    try {
      await updateDoc(doc(firebaseDb, "requests", requestId), {
        status: nextStatus,
        last_updated: serverTimestamp(),
        handled_by: adminUser?.email ?? DEFAULT_HANDLED_BY,
      });
    } finally {
      setUpdatingId("");
    }
  }

  async function initializeSignalWindow(request: SupportRequestRecord) {
    if (!firebaseDb) {
      setSignalStatus(firebaseEnvErrorMessage || "Firebase is not configured.");
      return;
    }

    const userPhone = sanitizePhone(getFamilyPhone(request));
    const userEmail = getFamilyEmail(request);

    if (!userPhone && !userEmail) {
      setSignalStatus("No family-provided phone number or email is available for this request.");
      return;
    }

    const initializedAt = new Date();
    const expiresAt = new Date(initializedAt.getTime() + 6 * 60 * 60 * 1000);
    const fullMemo = buildSignalWindowMemo(request, initializedAt, expiresAt);

    setSignalStatus("Initializing six-hour signal window...");
    setInitializingSignalId(request.id);

    try {
      await updateDoc(doc(firebaseDb, "requests", request.id), {
        status: "OFFICER CONTACTED",
        last_updated: serverTimestamp(),
        handled_by: adminUser?.email ?? DEFAULT_HANDLED_BY,
        signal_window_initialized_at: initializedAt,
        signal_window_expires_at: expiresAt,
        signal_window_memo: fullMemo,
      });

      if (userPhone) {
        window.open("https://wa.me/" + userPhone + "?text=" + encodeURIComponent(fullMemo));
      }

      if (userEmail) {
        window.location.href =
          "mailto:" +
          userEmail +
          "?subject=" +
          encodeURIComponent("OFFICIAL NOTICE: Signal Priority ID-" + request.id) +
          "&body=" +
          encodeURIComponent(fullMemo);
      }

      setSignalStatus(`Signal window initialized. Window Expiry: ${formatSignalTime(expiresAt)}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setSignalStatus(`Signal window failed: ${message}`);
    } finally {
      setInitializingSignalId("");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050a06] text-[#d7e0d8]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(213,181,90,0.16),transparent_20%),radial-gradient(circle_at_78%_10%,rgba(70,96,67,0.28),transparent_24%),linear-gradient(180deg,rgba(0,0,0,0.28),rgba(0,0,0,0.5))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,168,133,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,168,133,0.05)_1px,transparent_1px)] bg-[size:62px_62px] opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-[repeating-linear-gradient(135deg,#d6b14f_0,#d6b14f_18px,#0f150f_18px,#0f150f_36px)]" />

      <div className="relative mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="soft-outline panel-sheen mb-6 overflow-hidden rounded-[30px] border border-[#233426] bg-[linear-gradient(135deg,rgba(11,20,14,0.97),rgba(15,27,18,0.95))]">
          <div className="grid gap-4 border-b border-[#2d4031] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#d6b14f] sm:grid-cols-3 sm:px-7">
            <p>Restricted Logistics Console</p>
            <p className="sm:text-center">Administrative Case Review Board</p>
            <p className="sm:text-right">Sweep {securitySweep.toLocaleTimeString()}</p>
          </div>
          <div className="grid gap-5 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#95b48d]">
                LeaveDefensePortal
              </p>
              <h1 className="font-display text-3xl font-semibold text-[#f1f8f1] sm:text-4xl lg:text-5xl">
                Secure Admin Mission Control
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#aebfaf] sm:text-base">
                Review incoming support applications, inspect requester identity and contact
                paths, monitor operational urgency, and route follow-up through a single command
                dashboard.
              </p>
            </div>
            <div className="rounded-[24px] border border-[#314332] bg-black/20 px-5 py-4 text-sm text-[#dce6dd]">
              <p className="font-semibold uppercase tracking-[0.14em] text-[#d6b14f]">
                Officer Access
              </p>
              <p className="mt-2">Firebase-authenticated logistics review</p>
              <p className="text-[#91a792]">Live Firestore request queue and status handling</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-5 pb-6 sm:px-7">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-[#334633] bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Return Home
            </Link>
            <Link
              href="/dossier"
              className="inline-flex items-center gap-2 rounded-xl border border-[#7a6432] bg-[#1b2314] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#f2d271] transition hover:bg-[#232f1b]"
            >
              <ShieldAlert className="h-4 w-4" />
              Open Dossier Portal
            </Link>
          </div>
        </header>

        {firebaseUnavailable ? (
          <section className="soft-outline rounded-[26px] border border-[#6e5c37] bg-[#231d12] p-6">
            <p className="text-sm text-[#f0d28a]">
              Firebase configuration is missing. {firebaseEnvErrorMessage}
            </p>
            <p className="mt-2 text-xs text-[#d0c4a2]">
              Ensure `.env.local` exists in the project root, then restart the dev server.
            </p>
          </section>
        ) : authLoading ? (
          <section className="soft-outline rounded-[26px] border border-[#233426] bg-[#101612] p-6">
            <p className="text-sm text-[#95a998]">Verifying secure session...</p>
          </section>
        ) : !adminUser ? (
          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="soft-outline overflow-hidden rounded-[28px] border border-[#233426] bg-[linear-gradient(180deg,rgba(12,21,15,0.98),rgba(16,28,20,0.96))]">
              <div className="border-b border-[#2d4031] px-5 py-4 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b14f]">
                  Access Conditions
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-[#f0f6ef]">
                  Authorized Logistics Personnel Only
                </h2>
              </div>
              <div className="grid gap-4 px-5 py-5 sm:px-6">
                {[
                  "Officer access is validated through Firebase Authentication and a server-side restricted identity check.",
                  "All support applications are streamed from the Firestore command ledger in real time after sign-in.",
                  "Request packets can include requester identity, location, address, social contact paths, and optional ID evidence.",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-[22px] border border-[#324533] bg-black/20 px-4 py-4 text-sm leading-7 text-[#dbe5dc]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </article>

            <section className="soft-outline rounded-[28px] border border-[#233426] bg-[linear-gradient(180deg,rgba(12,21,15,0.98),rgba(16,28,20,0.96))] p-6">
              <h2 className="font-display text-2xl font-semibold text-[#f2f7f2]">
                Administrative Sign-In
              </h2>
              <p className="mt-2 text-sm text-[#96aa98]">
                Enter approved logistics credentials to open the case review board.
              </p>
              <div className="mt-5 space-y-4">
                <div>
                  <label htmlFor="admin-email" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#9cb499]">
                    Email
                  </label>
                  <input
                    id="admin-email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-[#40533f] bg-[#0d1510] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                  />
                </div>
                <div>
                  <label htmlFor="admin-password" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#9cb499]">
                    Password
                  </label>
                  <input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-[#40533f] bg-[#0d1510] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogin}
                disabled={loggingIn}
                className="mt-5 w-full rounded-xl bg-[#d4b55a] px-4 py-3 text-sm font-semibold text-[#16200d] transition hover:bg-[#e1c26a] disabled:opacity-60"
              >
                {loggingIn ? "Signing in..." : "Enter Mission Control"}
              </button>
              {loginStatus && <p className="mt-3 text-sm text-[#9fb4a1]">{loginStatus}</p>}
            </section>
          </section>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
              <article className="soft-outline rounded-[24px] border border-[#233426] bg-[linear-gradient(180deg,rgba(13,22,16,0.98),rgba(16,28,20,0.96))] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9cb499]">
                  Unreviewed
                </p>
                <p className="mt-3 inline-flex items-center gap-2 text-3xl font-semibold text-[#f2f7f2]">
                  <BellDot className="h-7 w-7 text-[#d6b14f]" />
                  {pendingCount}
                </p>
              </article>
              <article className="soft-outline rounded-[24px] border border-[#233426] bg-[linear-gradient(180deg,rgba(13,22,16,0.98),rgba(16,28,20,0.96))] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9cb499]">
                  In Progress
                </p>
                <p className="mt-3 inline-flex items-center gap-2 text-3xl font-semibold text-[#f2f7f2]">
                  <RadioTower className="h-7 w-7 text-[#d6b14f]" />
                  {inProgressCount}
                </p>
              </article>
              <article className="soft-outline rounded-[24px] border border-[#233426] bg-[linear-gradient(180deg,rgba(13,22,16,0.98),rgba(16,28,20,0.96))] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9cb499]">
                  Completed
                </p>
                <p className="mt-3 inline-flex items-center gap-2 text-3xl font-semibold text-[#f2f7f2]">
                  <CircleCheckBig className="h-7 w-7 text-[#d6b14f]" />
                  {completedCount}
                </p>
              </article>
              <article className="soft-outline rounded-[24px] border border-[#233426] bg-[linear-gradient(180deg,rgba(13,22,16,0.98),rgba(16,28,20,0.96))] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9cb499]">
                  Signed In Officer
                </p>
                <p className="mt-3 text-base font-semibold text-[#f2f7f2]">{adminUser.email}</p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-4 rounded-xl border border-[#40533f] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition hover:bg-white/5"
                >
                  Sign Out
                </button>
              </article>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[360px_1fr]">
              <aside className="soft-outline overflow-hidden rounded-[28px] border border-[#233426] bg-[linear-gradient(180deg,rgba(12,21,15,0.98),rgba(16,28,20,0.96))]">
                <div className="border-b border-[#2d4031] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b14f]">
                    Request Queue
                  </p>
                  <p className="mt-2 text-sm text-[#97ab98]">
                    Select a case to open the full logistics review board.
                  </p>
                </div>

                <div className="max-h-[74dvh] space-y-3 overflow-y-auto px-4 py-4">
                  {requests.length === 0 ? (
                    <div className="rounded-[22px] border border-[#324533] bg-black/20 px-4 py-5 text-sm text-[#93a692]">
                      No requests yet. Submit a support application from the dossier portal to start
                      the review flow.
                    </div>
                  ) : (
                    requests.map((record) => {
                      const active = selectedRequest?.id === record.id;
                      const status = record.data.status ?? "UNREVIEWED";
                      const urgency = (record.data.urgency_level ?? "LOW").toUpperCase();

                      return (
                        <button
                          key={record.id}
                          type="button"
                          onClick={() => setSelectedRequestId(record.id)}
                          className={`w-full rounded-[22px] border p-4 text-left transition ${
                            active
                              ? "border-[#d6b14f] bg-[#162116]"
                              : "border-[#324533] bg-black/20 hover:border-[#566c53]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9cb499]">
                                {record.data.request_label ?? record.data.request_type ?? "Support Request"}
                              </p>
                              <p className="mt-2 font-display text-xl font-semibold text-[#f2f7f2]">
                                {getRequesterName(record)}
                              </p>
                              <p className="mt-1 text-sm text-[#9eb39e]">
                                For {record.data.member_rank ?? ""} {record.data.member_name ?? "Unknown member"}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] ${
                                status === "UNREVIEWED"
                                  ? "bg-[#163b1b] text-[#8af1a0]"
                                  : status === "COMPLETED"
                                    ? "bg-[#243127] text-[#d2e2d3]"
                                    : "bg-[#4d3d18] text-[#ffdb83]"
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em]">
                            <span className="rounded-full border border-[#425540] px-2 py-1 text-[#cddbce]">
                              {urgency}
                            </span>
                            <span className="rounded-full border border-[#425540] px-2 py-1 text-[#cddbce]">
                              {toDatetimeLabel(record.data.request_timestamp)}
                            </span>
                          </div>
                          <p className="mt-4 text-sm leading-6 text-[#b6c6b7]">
                            {summarizeNotes(record.data.notes)}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </aside>

              <section className="soft-outline overflow-hidden rounded-[28px] border border-[#233426] bg-[linear-gradient(180deg,rgba(12,21,15,0.98),rgba(16,28,20,0.96))]">
                {!selectedRequest ? (
                  <div className="px-6 py-10 text-sm text-[#97ab98]">
                    No active request selected.
                  </div>
                ) : (
                  <>
                    <div className="border-b border-[#2d4031] px-5 py-5 sm:px-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b14f]">
                            Active Case Review
                          </p>
                          <h2 className="mt-2 font-display text-3xl font-semibold text-[#f1f8f1]">
                            {getRequesterName(selectedRequest)}
                          </h2>
                          <p className="mt-2 text-sm text-[#aebfaf]">
                            {getRequesterRelationship(selectedRequest)} · For {selectedRequest.data.member_rank ?? ""}{" "}
                            {selectedRequest.data.member_name ?? "Unknown member"}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-[#344834] bg-black/20 px-4 py-3 text-sm text-[#dbe5dc]">
                          <p>
                            <span className="font-semibold text-[#f3f7f2]">Request ID:</span>{" "}
                            {selectedRequest.id}
                          </p>
                          <p className="mt-1">
                            <span className="font-semibold text-[#f3f7f2]">Member ID:</span>{" "}
                            {getRequestMemberId(selectedRequest)}
                          </p>
                          <p className="mt-1">
                            <span className="font-semibold text-[#f3f7f2]">Preferred Channel:</span>{" "}
                            {selectedRequest.data.contact?.preferred_channel ?? "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5 px-5 py-5 sm:px-6 xl:grid-cols-[1.1fr_0.9fr]">
                      <div className="grid gap-5">
                        <div className="grid gap-5 lg:grid-cols-2">
                          <article className="rounded-[24px] border border-[#314332] bg-black/20 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d6b14f]">
                              Request Snapshot
                            </p>
                            <div className="mt-4 space-y-2 text-sm text-[#dde6dd]">
                              <p>
                                <span className="text-[#9db29d]">Service Lane</span>
                                <br />
                                {selectedRequest.data.request_label ?? selectedRequest.data.request_type ?? "-"}
                              </p>
                              <p>
                                <span className="text-[#9db29d]">Urgency</span>
                                <br />
                                {(selectedRequest.data.urgency_level ?? "-").toUpperCase()}
                              </p>
                              <p>
                                <span className="text-[#9db29d]">Status</span>
                                <br />
                                {selectedRequest.data.status ?? "UNREVIEWED"}
                              </p>
                              <p>
                                <span className="text-[#9db29d]">Submitted</span>
                                <br />
                                {toDatetimeLabel(selectedRequest.data.request_timestamp)}
                              </p>
                            </div>
                          </article>

                          <article className="rounded-[24px] border border-[#314332] bg-black/20 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d6b14f]">
                              Handling Status
                            </p>
                            <div className="mt-4 space-y-2 text-sm text-[#dde6dd]">
                              <p>
                                <span className="text-[#9db29d]">Handled By</span>
                                <br />
                                {selectedRequest.data.handled_by ??
                                  adminUser.email ??
                                  DEFAULT_HANDLED_BY}
                              </p>
                              <p>
                                <span className="text-[#9db29d]">Last Updated</span>
                                <br />
                                {toDatetimeLabel(selectedRequest.data.last_updated)}
                              </p>
                              <p>
                                <span className="text-[#9db29d]">Source Channel</span>
                                <br />
                                {selectedRequest.data.channel ?? "PUBLIC_DOSSIER_PORTAL"}
                              </p>
                            </div>
                          </article>
                        </div>

                        <article className="rounded-[24px] border border-[#314332] bg-black/20 p-4">
                          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#d6b14f]">
                            <UserRound className="h-4 w-4" />
                            Requester Identity
                          </p>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <p className="text-sm text-[#dde6dd]">
                              <span className="text-[#9db29d]">Requester Name</span>
                              <br />
                              {getRequesterName(selectedRequest)}
                            </p>
                            <p className="text-sm text-[#dde6dd]">
                              <span className="text-[#9db29d]">Relationship</span>
                              <br />
                              {getRequesterRelationship(selectedRequest)}
                            </p>
                            <p className="text-sm text-[#dde6dd] md:col-span-2">
                              <span className="text-[#9db29d]">Current Location</span>
                              <br />
                              {selectedRequest.data.requester_location ?? "No current location provided."}
                            </p>
                            <p className="text-sm text-[#dde6dd] md:col-span-2">
                              <span className="text-[#9db29d]">Home Address</span>
                              <br />
                              {formatAddress(selectedRequest)}
                            </p>
                          </div>
                        </article>

                        <article className="rounded-[24px] border border-[#314332] bg-black/20 p-4">
                          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#d6b14f]">
                            <MapPinned className="h-4 w-4" />
                            Contact Matrix
                          </p>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <p className="text-sm text-[#dde6dd]">
                              <span className="text-[#9db29d]">Primary Phone</span>
                              <br />
                              {selectedRequest.data.contact?.primary_phone ?? "-"}
                            </p>
                            <p className="text-sm text-[#dde6dd]">
                              <span className="text-[#9db29d]">Alternate Phone</span>
                              <br />
                              {selectedRequest.data.contact?.alternate_phone ?? "-"}
                            </p>
                            <p className="text-sm text-[#dde6dd]">
                              <span className="text-[#9db29d]">Primary Email</span>
                              <br />
                              {selectedRequest.data.contact?.primary_email ?? "-"}
                            </p>
                            <p className="text-sm text-[#dde6dd]">
                              <span className="text-[#9db29d]">Alternate Email</span>
                              <br />
                              {selectedRequest.data.contact?.alternate_email ?? "-"}
                            </p>
                          </div>
                        </article>

                        <article className="rounded-[24px] border border-[#314332] bg-black/20 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d6b14f]">
                            Operational Notes
                          </p>
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#dbe5dc]">
                            {selectedRequest.data.notes?.trim() ||
                              "No operational notes were submitted with this request."}
                          </p>
                        </article>
                      </div>

                      <div className="grid gap-5">
                        <article className="rounded-[24px] border border-[#314332] bg-black/20 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d6b14f]">
                            Officer Actions
                          </p>
                          <div className="mt-4 grid gap-3">
                            <div className="rounded-[20px] border border-[#40533f] bg-[#0d1510] p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9cb499]">
                                Signal Priority Window
                              </p>
                              <p className="mt-2 text-sm leading-6 text-[#cfd9d0]">
                                Opens a six-hour follow-up window using the member ID, rank, and
                                family-provided phone number from this Firestore request.
                              </p>
                              <div className="mt-3 grid gap-2 text-xs text-[#9db29d]">
                                <p>
                                  Member ID:{" "}
                                  <span className="font-semibold text-[#eef4ec]">
                                    {getRequestMemberId(selectedRequest)}
                                  </span>
                                </p>
                                <p>
                                  Rank:{" "}
                                  <span className="font-semibold text-[#eef4ec]">
                                    {selectedRequest.data.member_rank ?? "Not supplied"}
                                  </span>
                                </p>
                                <p>
                                  Family Phone:{" "}
                                  <span className="font-semibold text-[#eef4ec]">
                                    {getFamilyPhone(selectedRequest) || "Not supplied"}
                                  </span>
                                </p>
                                {selectedRequest.data.signal_window_expires_at && (
                                  <p>
                                    Current Window Expiry:{" "}
                                    <span className="font-semibold text-[#f4df95]">
                                      {toDatetimeLabel(selectedRequest.data.signal_window_expires_at)}
                                    </span>
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => initializeSignalWindow(selectedRequest)}
                                disabled={initializingSignalId === selectedRequest.id}
                                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d4b55a] px-4 py-3 text-sm font-semibold text-[#16200d] transition hover:bg-[#e2c46b] disabled:opacity-60"
                              >
                                <RadioTower className="h-4 w-4" />
                                {initializingSignalId === selectedRequest.id
                                  ? "Initializing Signal Window..."
                                  : "Initialize Signal Window"}
                              </button>
                              {signalStatus && (
                                <p className="mt-3 text-xs leading-5 text-[#aebfaf]">{signalStatus}</p>
                              )}
                            </div>
                            <a
                              href={toCallLink(selectedRequest) || "#"}
                              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                                toCallLink(selectedRequest)
                                  ? "bg-[#254f2c] text-white hover:bg-[#2c6034]"
                                  : "cursor-not-allowed bg-[#233327] text-[#7f9581]"
                              }`}
                              onClick={(event) => {
                                if (!toCallLink(selectedRequest)) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <PhoneCall className="h-4 w-4" />
                              Call Requester
                            </a>
                            <a
                              href={toWhatsappLink(selectedRequest) || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                                toWhatsappLink(selectedRequest)
                                  ? "bg-[#0d5f2a] text-white hover:bg-[#127434]"
                                  : "cursor-not-allowed bg-[#274031] text-[#7d947f]"
                              }`}
                              onClick={(event) => {
                                if (!toWhatsappLink(selectedRequest)) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <RadioTower className="h-4 w-4" />
                              Open WhatsApp Follow-Up
                            </a>
                            <a
                              href={toMailLink(selectedRequest) || "#"}
                              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                                toMailLink(selectedRequest)
                                  ? "bg-[#1d4e89] text-white hover:bg-[#2562ac]"
                                  : "cursor-not-allowed bg-[#2b3f58] text-[#8ba1bd]"
                              }`}
                              onClick={(event) => {
                                if (!toMailLink(selectedRequest)) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <Mail className="h-4 w-4" />
                              Send Email Follow-Up
                            </a>
                            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9cb499]">
                              Update Status
                            </label>
                            <select
                              value={(selectedRequest.data.status ?? "UNREVIEWED") as RequestStatus}
                              onChange={(event) =>
                                updateStatus(selectedRequest.id, event.target.value as RequestStatus)
                              }
                              disabled={updatingId === selectedRequest.id}
                              className="rounded-xl border border-[#40533f] bg-[#0d1510] px-3 py-3 text-sm font-semibold text-[#d7e0d8] outline-none disabled:opacity-60"
                            >
                              <option value="UNREVIEWED">UNREVIEWED</option>
                              <option value="IN PROGRESS">IN PROGRESS</option>
                              <option value="OFFICER CONTACTED">OFFICER CONTACTED</option>
                              <option value="COMPLETED">COMPLETED</option>
                            </select>
                          </div>
                        </article>

                        <article className="rounded-[24px] border border-[#314332] bg-black/20 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#d6b14f]">
                            Social Contact Paths
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {getSocialEntries(selectedRequest).length === 0 ? (
                              <p className="text-sm text-[#8fa390]">No social handles supplied.</p>
                            ) : (
                              getSocialEntries(selectedRequest).map((entry) =>
                                entry.href ? (
                                  <a
                                    key={entry.key}
                                    href={entry.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-[#415540] bg-[#122015] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#dde7de]"
                                  >
                                    {entry.label}: {entry.value}
                                  </a>
                                ) : (
                                  <span
                                    key={entry.key}
                                    className="rounded-full border border-[#415540] bg-[#122015] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#dde7de]"
                                  >
                                    {entry.label}: {entry.value}
                                  </span>
                                ),
                              )
                            )}
                          </div>
                        </article>

                        <article className="rounded-[24px] border border-[#314332] bg-black/20 p-4">
                          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#d6b14f]">
                            <ShieldCheck className="h-4 w-4" />
                            Optional ID Evidence
                          </p>
                          <div className="mt-4 space-y-2 text-sm text-[#dde6dd]">
                            <p>
                              <span className="text-[#9db29d]">Document Type</span>
                              <br />
                              {selectedRequest.data.identification?.document_type ?? "Not supplied"}
                            </p>
                            <p>
                              <span className="text-[#9db29d]">Document Number</span>
                              <br />
                              {selectedRequest.data.identification?.document_number ?? "Not supplied"}
                            </p>
                          </div>

                          {(selectedRequest.data.identification?.front_image_url ||
                            selectedRequest.data.identification?.back_image_url) && (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              {selectedRequest.data.identification?.front_image_url && (
                                <a
                                  href={selectedRequest.data.identification.front_image_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block"
                                >
                                  <img
                                    src={selectedRequest.data.identification.front_image_url}
                                    alt="Front identification document"
                                    className="h-40 w-full rounded-[18px] border border-[#415540] object-cover"
                                  />
                                </a>
                              )}
                              {selectedRequest.data.identification?.back_image_url && (
                                <a
                                  href={selectedRequest.data.identification.back_image_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block"
                                >
                                  <img
                                    src={selectedRequest.data.identification.back_image_url}
                                    alt="Back identification document"
                                    className="h-40 w-full rounded-[18px] border border-[#415540] object-cover"
                                  />
                                </a>
                              )}
                            </div>
                          )}
                        </article>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

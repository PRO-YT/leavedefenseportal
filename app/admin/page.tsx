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
  FileText,
  Mail,
  MapPinned,
  PhoneCall,
  Package,
  RadioTower,
  Send,
  ShieldAlert,
  ShieldCheck,
  Timer,
  UserRound,
} from "lucide-react";

import { firebaseAuth, firebaseDb } from "@/lib/firebase/client";
import { firebaseEnvErrorMessage } from "@/lib/firebase/config";
import {
  type AdminProtocolType,
  type RequestStatus,
  type RequestSocialContacts,
  type ServiceType,
  type ShoppingWeightType,
  type SupportRequestDocument,
  type SupportRequestRecord,
} from "@/lib/support-requests";

const DEFAULT_HANDLED_BY = "Logistics Officer Desk";
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const DEFAULT_SUPPLY_ITEMS = [
  "Hygiene and wellness supplies",
  "Shelf-stable morale support items",
  "Replacement personal essentials",
].join("\n");

type AdminProtocol = AdminProtocolType;
type ShoppingWeight = ShoppingWeightType;

const PROTOCOL_OPTIONS: Array<{
  value: AdminProtocol;
  label: string;
  description: string;
}> = [
  {
    value: "FLIGHT",
    label: "Flight",
    description: "Travel coordination and itinerary follow-up.",
  },
  {
    value: "COMMS",
    label: "Comms",
    description: "Call-time, recharge, and family contact support.",
  },
  {
    value: "SHOPPING",
    label: "Shopping",
    description: "Package weight pricing, procurement notes, and manifest drafts.",
  },
  {
    value: "MWR",
    label: "MWR",
    description: "Morale, welfare, recreation, and impact acknowledgment support.",
  },
];

const SHOPPING_WEIGHT_PRICING: Record<
  ShoppingWeight,
  {
    label: string;
    amount: number;
    description: string;
  }
> = {
  LIGHT: {
    label: "Light",
    amount: 250,
    description: "Small personal essentials and low-weight morale items.",
  },
  MEDIUM: {
    label: "Medium",
    amount: 450,
    description: "Mixed supply pack with moderate handling requirements.",
  },
  HEAVY: {
    label: "Heavy / Urgent",
    amount: 700,
    description: "High-weight or expedited support requiring elevated handling.",
  },
};

const DONATION_IMPACT_TIERS = [
  { amount: 100, label: "Platoon Internet Access" },
  { amount: 500, label: "Unit Recreation Event" },
  { amount: 1000, label: "Deployed Family Support" },
];
const MWR_TAX_EXEMPT_BADGE = "Section 501(c)(19) Military Organization";

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

function getProtocolOption(protocol: AdminProtocol) {
  return PROTOCOL_OPTIONS.find((option) => option.value === protocol) ?? PROTOCOL_OPTIONS[0];
}

function protocolFromRequestType(requestType: ServiceType | undefined): AdminProtocol {
  if (requestType === "CALL_TIME") {
    return "COMMS";
  }

  if (requestType === "SHOPPING" || requestType === "MWR" || requestType === "FLIGHT") {
    return requestType;
  }

  return "FLIGHT";
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function getDonationImpact(amount: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const matchingTier = [...DONATION_IMPACT_TIERS]
    .sort((left, right) => right.amount - left.amount)
    .find((tier) => safeAmount >= tier.amount);

  return matchingTier ?? { amount: 0, label: "General Morale Support" };
}

function parseSupplyItems(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getMemberUnit(request: SupportRequestRecord) {
  return request.data.member_unit || "Unit not supplied";
}

function buildProtocolSubject(protocol: AdminProtocol, request: SupportRequestRecord) {
  return `Support Notice: ${getProtocolOption(protocol).label} Protocol ID-${request.id}`;
}

function buildProtocolMemo({
  donationAmount,
  generatedAt,
  protocol,
  request,
  shoppingWeight,
  supplyItems,
}: {
  donationAmount: number;
  generatedAt: Date;
  protocol: AdminProtocol;
  request: SupportRequestRecord;
  shoppingWeight: ShoppingWeight;
  supplyItems: string;
}) {
  const protocolOption = getProtocolOption(protocol);
  const deadline = new Date(generatedAt.getTime() + FOUR_HOURS_MS);
  const memberId = getRequestMemberId(request);
  const memberRank = request.data.member_rank || "Rank not supplied";
  const memberName = request.data.member_name || "Member name not supplied";
  const preferredChannel = request.data.contact?.preferred_channel || "Not specified";
  const requesterName = getRequesterName(request);
  const requesterRelationship = getRequesterRelationship(request);
  const familyPhone = getFamilyPhone(request) || "Phone number not supplied";
  const familyEmail = getFamilyEmail(request) || "Email not supplied";
  const shoppingTier = SHOPPING_WEIGHT_PRICING[shoppingWeight];
  const donationImpact = getDonationImpact(donationAmount);
  const parsedSupplyItems = parseSupplyItems(supplyItems);
  const itemSummary =
    parsedSupplyItems.length > 0
      ? parsedSupplyItems.join("; ")
      : "Items pending officer review";

  const header = [
    `${protocolOption.label.toUpperCase()} PROTOCOL MEMO`,
    `Request ID: ${request.id}`,
    `Member ID: ${memberId}`,
    `Rank: ${memberRank}`,
    `Member: ${memberName}`,
    `Requester: ${requesterName} (${requesterRelationship})`,
    `Family Phone: ${familyPhone}`,
    `Family Email: ${familyEmail}`,
    `Preferred Contact Channel: ${preferredChannel}`,
    `Generated: ${formatSignalTime(generatedAt)}`,
    "",
  ];

  if (protocol === "SHOPPING") {
    return [
      ...header,
      "Paragraph 1: Your procurement support request has been opened for logistics officer review. The details below are being used to classify the package, confirm item availability, and prepare the family follow-up route.",
      `Paragraph 2: The selected package class is ${shoppingTier.label}. The current planning amount is ${formatCurrency(shoppingTier.amount)} based on package weight and handling requirements.`,
      `Paragraph 3: Items currently listed for procurement review: ${itemSummary}. Substitutions, vendor availability, and delivery constraints will be confirmed before any final instruction is issued.`,
      `Paragraph 4: Contact routing will prioritize ${preferredChannel}. If that route is unavailable, the logistics officer may use the family phone or email listed above to prevent delays.`,
      `Paragraph 5: Sortie Countdown - this shopping memo was generated at ${formatSignalTime(generatedAt)}. The four-hour response window closes at ${formatSignalTime(deadline)}; please reply before expiry with item confirmations, substitutions, or any urgent changes.`,
      "Paragraph 6: This memo is a planning notice only. A supply manifest draft may be generated for review, but it is not a payment receipt, tax document, or confirmation that funds were received.",
      "",
      "Respectfully,",
      DEFAULT_HANDLED_BY,
    ].join("\n");
  }

  if (protocol === "MWR") {
    const certificateName = request.data.mwr_certificate_name || requesterName;
    const trustBadge = request.data.mwr_trust_badge || MWR_TAX_EXEMPT_BADGE;

    return [
      ...header,
      "Paragraph 1: Your morale, welfare, and recreation support request has been routed for eligibility and impact review.",
      `Paragraph 2: The current support amount is ${formatCurrency(donationAmount)} with the impact label "${donationImpact.label}". This label explains the intended support category for family-facing coordination.`,
      `Paragraph 3: Trust badge: ${trustBadge}. The request is associated with ${memberRank} ${memberName}, Member ID ${memberId}, and unit reference: ${getMemberUnit(request)}.`,
      `Paragraph 4: Contact routing will prioritize ${preferredChannel}. The logistics officer will use the family-provided phone or email if additional verification is required.`,
      `Paragraph 5: Coordination Countdown - this MWR memo was generated at ${formatSignalTime(generatedAt)}. The four-hour response window closes at ${formatSignalTime(deadline)} so the family can confirm donor name, spelling, and acknowledgment details.`,
      `Paragraph 6: Certificate of Appreciation will be prepared for ${certificateName} after payment confirmation and attached to this MWR support record.`,
      "",
      "Respectfully,",
      DEFAULT_HANDLED_BY,
    ].join("\n");
  }

  if (protocol === "COMMS") {
    return [
      ...header,
      "Paragraph 1: Your communications support request has been opened for logistics officer review and family follow-up.",
      `Paragraph 2: This request is associated with ${memberRank} ${memberName}, Member ID ${memberId}. The current service lane is call-time, recharge, or family contact support.`,
      `Paragraph 3: The officer will verify destination network, activation timing, and any restrictions recorded in the family notes before final coordination.`,
      `Paragraph 4: Contact routing will prioritize ${preferredChannel}, with WhatsApp, phone, email, or social contact paths used only when provided by the family.`,
      `Paragraph 5: Signal Countdown - this communications memo was generated at ${formatSignalTime(generatedAt)}. The four-hour response window closes at ${formatSignalTime(deadline)} for confirmation of provider, phone number, and preferred activation window.`,
      "Paragraph 6: This memo is a coordination preview and should be reviewed by the officer before dispatch.",
      "",
      "Respectfully,",
      DEFAULT_HANDLED_BY,
    ].join("\n");
  }

  return [
    ...header,
    "Paragraph 1: Your flight support request has been opened for travel coordination review.",
    `Paragraph 2: This request is associated with ${memberRank} ${memberName}, Member ID ${memberId}, and will be reviewed against the details provided by the family.`,
    "Paragraph 3: The officer will confirm traveler names, departure city, destination city, timing, mobility needs, and any urgent restrictions before follow-up.",
    `Paragraph 4: Contact routing will prioritize ${preferredChannel}. Backup outreach may use family phone, email, WhatsApp, or supplied social paths as available.`,
    `Paragraph 5: Flight Coordination Countdown - this memo was generated at ${formatSignalTime(generatedAt)}. The four-hour response window closes at ${formatSignalTime(deadline)} for itinerary readiness and schedule confirmation.`,
    "Paragraph 6: This memo is a coordination preview and should be reviewed by the officer before dispatch.",
    "",
    "Respectfully,",
    DEFAULT_HANDLED_BY,
  ].join("\n");
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

function buildSocialDispatchHref(
  entry: ReturnType<typeof getSocialEntries>[number],
  memo: string,
) {
  const encodedMemo = encodeURIComponent(memo);

  if (entry.key === "whatsapp") {
    const digits = sanitizePhone(entry.value);
    return digits ? `https://wa.me/${digits}?text=${encodedMemo}` : entry.href;
  }

  if (entry.key === "telegram") {
    return `https://t.me/share/url?text=${encodedMemo}`;
  }

  if (entry.key === "x") {
    return `https://x.com/intent/post?text=${encodedMemo}`;
  }

  return entry.href;
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
  const [selectedProtocol, setSelectedProtocol] = useState<AdminProtocol>("FLIGHT");
  const [shoppingWeight, setShoppingWeight] = useState<ShoppingWeight>("LIGHT");
  const [donationAmount, setDonationAmount] = useState(100);
  const [supplyItems, setSupplyItems] = useState(DEFAULT_SUPPLY_ITEMS);
  const [protocolStatus, setProtocolStatus] = useState("");

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
  const selectedRequestKey = selectedRequest?.id ?? "";
  const selectedRequestType = selectedRequest?.data.request_type;
  const selectedRequestMwrAmount = selectedRequest?.data.mwr_donation_amount;

  useEffect(() => {
    if (!selectedRequestKey) {
      return;
    }

    setSelectedProtocol(protocolFromRequestType(selectedRequestType));
    if (typeof selectedRequestMwrAmount === "number") {
      setDonationAmount(selectedRequestMwrAmount);
    }
    setProtocolStatus("");
  }, [selectedRequestKey, selectedRequestMwrAmount, selectedRequestType]);

  const shoppingPricing = SHOPPING_WEIGHT_PRICING[shoppingWeight];
  const donationImpact = getDonationImpact(donationAmount);

  const protocolMemo = useMemo(() => {
    if (!selectedRequest) {
      return "";
    }

    return buildProtocolMemo({
      donationAmount,
      generatedAt: securitySweep,
      protocol: selectedProtocol,
      request: selectedRequest,
      shoppingWeight,
      supplyItems,
    });
  }, [
    donationAmount,
    securitySweep,
    selectedProtocol,
    selectedRequest,
    shoppingWeight,
    supplyItems,
  ]);

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

  async function persistProtocolSnapshot(
    request: SupportRequestRecord,
    memo: string,
    generatedAt: Date,
  ) {
    if (!firebaseDb) {
      return;
    }

    const payload: Record<string, unknown> = {
      handled_by: adminUser?.email ?? DEFAULT_HANDLED_BY,
      last_updated: serverTimestamp(),
      protocol_memo: memo,
      protocol_memo_generated_at: generatedAt,
      protocol_selected: selectedProtocol,
    };

    if (selectedProtocol === "SHOPPING") {
      payload.shopping_amount = shoppingPricing.amount;
      payload.shopping_weight = shoppingWeight;
      payload.supply_manifest_items = parseSupplyItems(supplyItems);
    }

    if (selectedProtocol === "MWR") {
      payload.mwr_donation_amount = donationAmount;
      payload.mwr_impact_label = donationImpact.label;
      payload.mwr_certificate_name = request.data.mwr_certificate_name || getRequesterName(request);
      payload.mwr_trust_badge = request.data.mwr_trust_badge || MWR_TAX_EXEMPT_BADGE;
      payload.tax_documentation_status = "section_501c19";
    }

    await updateDoc(doc(firebaseDb, "requests", request.id), payload);
  }

  async function dispatchProtocolMemo(
    request: SupportRequestRecord,
    channel: "email" | "whatsapp",
  ) {
    const generatedAt = new Date();
    const memo = buildProtocolMemo({
      donationAmount,
      generatedAt,
      protocol: selectedProtocol,
      request,
      shoppingWeight,
      supplyItems,
    });

    setProtocolStatus(`Preparing ${channel === "whatsapp" ? "WhatsApp" : "email"} dispatch...`);

    try {
      await persistProtocolSnapshot(request, memo, generatedAt);

      if (channel === "whatsapp") {
        const userPhone = sanitizePhone(getFamilyPhone(request) || getPrimaryPhone(request));

        if (!userPhone) {
          setProtocolStatus("No family-provided phone number is available for WhatsApp dispatch.");
          return;
        }

        window.open("https://wa.me/" + userPhone + "?text=" + encodeURIComponent(memo));
        setProtocolStatus("WhatsApp dispatch window opened with the generated protocol memo.");
        return;
      }

      const userEmail = getFamilyEmail(request) || getPrimaryEmail(request);
      if (!userEmail) {
        setProtocolStatus("No family-provided email address is available for email dispatch.");
        return;
      }

      window.location.href =
        "mailto:" +
        userEmail +
        "?subject=" +
        encodeURIComponent(buildProtocolSubject(selectedProtocol, request)) +
        "&body=" +
        encodeURIComponent(memo);
      setProtocolStatus("Email client opened with the generated protocol memo.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setProtocolStatus(`Protocol dispatch failed: ${message}`);
    }
  }

  async function dispatchSocialProtocolMemo(
    entry: ReturnType<typeof getSocialEntries>[number],
    request: SupportRequestRecord,
  ) {
    const generatedAt = new Date();
    const memo = buildProtocolMemo({
      donationAmount,
      generatedAt,
      protocol: selectedProtocol,
      request,
      shoppingWeight,
      supplyItems,
    });
    const href = buildSocialDispatchHref(entry, memo);

    if (!href) {
      setProtocolStatus(`${entry.label} does not have an openable contact path.`);
      return;
    }

    setProtocolStatus(`Preparing ${entry.label} dispatch path...`);

    try {
      await persistProtocolSnapshot(request, memo, generatedAt);
      await navigator.clipboard?.writeText(memo).catch(() => undefined);
      window.open(href, "_blank", "noreferrer");
      setProtocolStatus(
        `${entry.label} opened. The memo was copied when browser permissions allowed it.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setProtocolStatus(`Social dispatch failed: ${message}`);
    }
  }

  function openPrintableDocument(title: string, bodyHtml: string) {
    const popup = window.open("", "_blank", "width=920,height=1100");

    if (!popup) {
      setProtocolStatus("Pop-up blocked. Allow pop-ups for this admin site, then try again.");
      return;
    }

    popup.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: #f3f1e8;
        color: #162015;
        font-family: Georgia, "Times New Roman", serif;
      }
      main {
        width: min(920px, calc(100% - 40px));
        margin: 24px auto;
        background: #fffef8;
        border: 2px solid #26351f;
        padding: 34px;
        box-shadow: 0 18px 45px rgba(0, 0, 0, 0.16);
      }
      h1, h2, p { margin: 0; }
      h1 { font-size: 34px; letter-spacing: 0.06em; text-transform: uppercase; }
      h2 { font-size: 18px; margin-top: 10px; color: #546235; }
      p { line-height: 1.65; }
      .muted { color: #596654; }
      .badge {
        display: inline-block;
        margin-top: 14px;
        border: 1px solid #8a7430;
        border-radius: 999px;
        padding: 7px 12px;
        color: #5c4713;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 24px; }
      .card { border: 1px solid #ccd2c3; border-radius: 14px; padding: 14px; background: #faf9f2; }
      .label { color: #6a7662; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .value { margin-top: 4px; font-size: 16px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 24px; }
      th, td { border: 1px solid #c7cebd; padding: 12px; text-align: left; vertical-align: top; }
      th { background: #ecedde; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; }
      .notice { margin-top: 24px; border-left: 4px solid #8a7430; background: #f7f1db; padding: 14px; }
      .certificate {
        min-height: 720px;
        display: grid;
        place-items: center;
        text-align: center;
        border: 8px double #26351f;
        padding: 34px;
      }
      .crest {
        display: inline-grid;
        height: 112px;
        width: 112px;
        place-items: center;
        border: 2px solid #8a7430;
        border-radius: 999px;
        color: #8a7430;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      @media print {
        body { background: #fff; }
        main { width: 100%; margin: 0; box-shadow: none; border: 0; }
      }
    </style>
  </head>
  <body>
    <main>${bodyHtml}</main>
    <script>window.setTimeout(function () { window.print(); }, 300);</script>
  </body>
</html>`);
    popup.document.close();
    popup.focus();
  }

  function generateSupplyManifest(request: SupportRequestRecord) {
    const generatedAt = new Date();
    const items = parseSupplyItems(supplyItems);
    const rows = (items.length > 0 ? items : ["Items pending officer review"])
      .map(
        (item, index) =>
          `<tr><td>${index + 1}</td><td>${escapeHtml(item)}</td><td>Procurement review</td></tr>`,
      )
      .join("");

    openPrintableDocument(
      "Supply Manifest Draft",
      `<section>
        <h1>Supply Manifest Draft</h1>
        <h2>Planning document - not a payment receipt</h2>
        <span class="badge">Procurement Review Copy</span>
        <div class="grid">
          <div class="card"><p class="label">Request ID</p><p class="value">${escapeHtml(request.id)}</p></div>
          <div class="card"><p class="label">Generated</p><p class="value">${escapeHtml(formatSignalTime(generatedAt))}</p></div>
          <div class="card"><p class="label">Member</p><p class="value">${escapeHtml(request.data.member_rank || "")} ${escapeHtml(request.data.member_name || "Not supplied")}</p></div>
          <div class="card"><p class="label">Member ID</p><p class="value">${escapeHtml(getRequestMemberId(request))}</p></div>
          <div class="card"><p class="label">Package Class</p><p class="value">${escapeHtml(shoppingPricing.label)}</p></div>
          <div class="card"><p class="label">Planning Amount</p><p class="value">${escapeHtml(formatCurrency(shoppingPricing.amount))}</p></div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Item Being Procured</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="notice">This supply manifest is a draft for officer review and family coordination. It does not confirm payment, shipment, tax treatment, or final procurement approval.</p>
      </section>`,
    );
    setProtocolStatus("Supply manifest draft opened. Use the browser print dialog to save as PDF.");
  }

  function generateAppreciationCertificate(request: SupportRequestRecord) {
    const generatedAt = new Date();
    const impact = getDonationImpact(donationAmount);
    const certificateName = request.data.mwr_certificate_name || getRequesterName(request);
    const trustBadge = request.data.mwr_trust_badge || MWR_TAX_EXEMPT_BADGE;

    openPrintableDocument(
      "Certificate of Appreciation",
      `<section class="certificate">
        <div>
          <div class="crest">Unit<br />Emblem<br />Area</div>
          <h1 style="margin-top: 22px;">Certificate of Appreciation</h1>
          <h2>${escapeHtml(trustBadge)}</h2>
          <p style="margin-top: 28px; font-size: 19px;">Presented to</p>
          <p style="margin-top: 10px; font-size: 32px; font-weight: 700;">${escapeHtml(certificateName)}</p>
          <p style="margin: 26px auto 0; max-width: 620px; font-size: 18px;">
            In recognition of support pledged toward ${escapeHtml(impact.label)} for the family-facing MWR coordination record associated with ${escapeHtml(request.data.member_rank || "Rank not supplied")} ${escapeHtml(request.data.member_name || "Member not supplied")}.
          </p>
          <p style="margin-top: 24px;" class="muted">Unit reference: ${escapeHtml(getMemberUnit(request))}</p>
          <p style="margin-top: 8px;" class="muted">Generated ${escapeHtml(formatSignalTime(generatedAt))} | Request ${escapeHtml(request.id)}</p>
          <p class="notice" style="text-align: left;">Issued as an appreciation certificate for the selected MWR support record after payment confirmation. This certificate is separate from any itemized payment receipt.</p>
        </div>
      </section>`,
    );
    setProtocolStatus(
      "Certificate opened. Use the browser print dialog to save as PDF after review.",
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050a06] text-[#d7e0d8]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(213,181,90,0.16),transparent_20%),radial-gradient(circle_at_78%_10%,rgba(70,96,67,0.28),transparent_24%),linear-gradient(180deg,rgba(0,0,0,0.28),rgba(0,0,0,0.5))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,168,133,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,168,133,0.05)_1px,transparent_1px)] bg-[size:62px_62px] opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-[repeating-linear-gradient(135deg,#d6b14f_0,#d6b14f_18px,#0f150f_18px,#0f150f_36px)]" />

      <div className="relative mx-auto w-full max-w-[1480px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="soft-outline panel-sheen mb-6 overflow-hidden rounded-[30px] border border-[#233426] bg-[linear-gradient(135deg,rgba(11,20,14,0.97),rgba(15,27,18,0.95))]">
          <div className="grid gap-4 border-b border-[#2d4031] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#d6b14f] md:grid-cols-3 sm:px-7">
            <p>Restricted Logistics Console</p>
            <p className="md:text-center">Administrative Case Review Board</p>
            <p className="md:text-right">Sweep {securitySweep.toLocaleTimeString()}</p>
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
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                <p className="mt-3 break-all text-base font-semibold text-[#f2f7f2]">{adminUser.email}</p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-4 rounded-xl border border-[#40533f] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition hover:bg-white/5"
                >
                  Sign Out
                </button>
              </article>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
              <aside className="soft-outline overflow-hidden rounded-[28px] border border-[#233426] bg-[linear-gradient(180deg,rgba(12,21,15,0.98),rgba(16,28,20,0.96))]">
                <div className="border-b border-[#2d4031] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b14f]">
                    Request Queue
                  </p>
                  <p className="mt-2 text-sm text-[#97ab98]">
                    Select a case to open the full logistics review board.
                  </p>
                </div>

                <div className="border-b border-[#2d4031] px-5 py-4">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b14f]">
                    <Send className="h-4 w-4" />
                    Protocol Switcher
                  </p>
                  <label
                    htmlFor="protocol-switcher"
                    className="mt-4 block text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9cb499]"
                  >
                    Choose Protocol
                  </label>
                  <select
                    id="protocol-switcher"
                    value={selectedProtocol}
                    onChange={(event) => {
                      setSelectedProtocol(event.target.value as AdminProtocol);
                      setProtocolStatus("");
                    }}
                    className="mt-2 w-full rounded-xl border border-[#40533f] bg-[#0d1510] px-3 py-3 text-sm font-semibold text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                  >
                    {PROTOCOL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-3 text-sm leading-6 text-[#9fb2a0]">
                    {getProtocolOption(selectedProtocol).description}
                  </p>
                  <p className="mt-3 rounded-[16px] border border-[#344834] bg-black/20 px-3 py-2 text-xs leading-5 text-[#c8d5c8]">
                    Active case: {selectedRequest ? selectedRequest.id : "No request selected"}
                  </p>
                </div>

                <div className="max-h-[60dvh] space-y-3 overflow-y-auto px-4 py-4 lg:max-h-[74dvh]">
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
                          className={`w-full min-w-0 rounded-[22px] border p-4 text-left transition ${
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
                              <p className="mt-2 break-words font-display text-xl font-semibold text-[#f2f7f2]">
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
                          <h2 className="mt-2 text-balance break-words font-display text-3xl font-semibold text-[#f1f8f1]">
                            {getRequesterName(selectedRequest)}
                          </h2>
                          <p className="mt-2 text-sm text-[#aebfaf]">
                            {getRequesterRelationship(selectedRequest)} · For {selectedRequest.data.member_rank ?? ""}{" "}
                            {selectedRequest.data.member_name ?? "Unknown member"}
                          </p>
                        </div>
                        <div className="w-full min-w-0 rounded-[22px] border border-[#344834] bg-black/20 px-4 py-3 text-sm text-[#dbe5dc] sm:w-auto">
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
                      <div className="grid gap-5 [overflow-wrap:anywhere]">
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

                      <div className="grid gap-5 [overflow-wrap:anywhere]">
                        <article className="rounded-[24px] border border-[#314332] bg-black/20 p-4">
                          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#d6b14f]">
                            <FileText className="h-4 w-4" />
                            Protocol Memo Builder
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[#aebfaf]">
                            Review the selected request, choose the protocol, then dispatch the
                            finalized memo through the family&apos;s available contact route.
                          </p>

                          <div className="mt-4 grid gap-4">
                            <div className="rounded-[20px] border border-[#40533f] bg-[#0d1510] p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9cb499]">
                                    Active Protocol
                                  </p>
                                  <p className="mt-1 font-display text-2xl font-semibold text-[#f2f7f2]">
                                    {getProtocolOption(selectedProtocol).label}
                                  </p>
                                </div>
                                <span className="rounded-full border border-[#74643a] bg-[#201b11] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[#f4d77c]">
                                  {selectedProtocol}
                                </span>
                              </div>

                              {selectedProtocol === "SHOPPING" && (
                                <div className="mt-4 grid gap-3">
                                  <label
                                    htmlFor="shopping-weight"
                                    className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9cb499]"
                                  >
                                    Package Weight
                                  </label>
                                  <select
                                    id="shopping-weight"
                                    value={shoppingWeight}
                                    onChange={(event) =>
                                      setShoppingWeight(event.target.value as ShoppingWeight)
                                    }
                                    className="rounded-xl border border-[#40533f] bg-[#101a13] px-3 py-3 text-sm font-semibold text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                                  >
                                    {(Object.keys(SHOPPING_WEIGHT_PRICING) as ShoppingWeight[]).map(
                                      (weight) => (
                                        <option key={weight} value={weight}>
                                          {SHOPPING_WEIGHT_PRICING[weight].label}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-[18px] border border-[#344834] bg-black/20 p-3">
                                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9cb499]">
                                        Amount
                                      </p>
                                      <p className="mt-1 text-2xl font-semibold text-[#f4df95]">
                                        {formatCurrency(shoppingPricing.amount)}
                                      </p>
                                    </div>
                                    <div className="rounded-[18px] border border-[#344834] bg-black/20 p-3">
                                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9cb499]">
                                        Handling Note
                                      </p>
                                      <p className="mt-1 text-sm leading-5 text-[#d6dfd6]">
                                        {shoppingPricing.description}
                                      </p>
                                    </div>
                                  </div>
                                  <label
                                    htmlFor="supply-items"
                                    className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9cb499]"
                                  >
                                    Items Being Procured
                                  </label>
                                  <textarea
                                    id="supply-items"
                                    value={supplyItems}
                                    onChange={(event) => setSupplyItems(event.target.value)}
                                    rows={5}
                                    className="min-h-32 rounded-xl border border-[#40533f] bg-[#101a13] px-3 py-3 text-sm leading-6 text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                                  />
                                </div>
                              )}

                              {selectedProtocol === "MWR" && (
                                <div className="mt-4 grid gap-3">
                                  <div className="rounded-[18px] border border-[#74643a] bg-[#201b11] px-3 py-3">
                                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[#f4d77c]">
                                      Tax-Exempt Badge
                                    </p>
                                    <p className="mt-2 inline-flex items-center rounded-full border border-[#d6b14f] bg-[#2a2413] px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-[#f5db83]">
                                      {selectedRequest.data.mwr_trust_badge || MWR_TAX_EXEMPT_BADGE}
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-[#eadca7]">
                                      This badge is included with the MWR checkout packet and the
                                      generated family memo.
                                    </p>
                                  </div>
                                  <label
                                    htmlFor="donation-amount"
                                    className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9cb499]"
                                  >
                                    Support Amount
                                  </label>
                                  <input
                                    id="donation-amount"
                                    type="number"
                                    min="0"
                                    step="25"
                                    value={donationAmount}
                                    onChange={(event) =>
                                      setDonationAmount(Math.max(0, Number(event.target.value) || 0))
                                    }
                                    className="rounded-xl border border-[#40533f] bg-[#101a13] px-3 py-3 text-sm font-semibold text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                                  />
                                  <div className="grid gap-2">
                                    {DONATION_IMPACT_TIERS.map((tier) => (
                                      <button
                                        key={tier.amount}
                                        type="button"
                                        onClick={() => setDonationAmount(tier.amount)}
                                        className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] transition ${
                                          donationAmount === tier.amount
                                            ? "border-[#d6b14f] bg-[#2a2515] text-[#f6dc84]"
                                            : "border-[#40533f] bg-black/20 text-[#cbd8cc] hover:border-[#627660]"
                                        }`}
                                      >
                                        {formatCurrency(tier.amount)} - {tier.label}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="rounded-[18px] border border-[#344834] bg-black/20 p-3">
                                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9cb499]">
                                      Impact Label
                                    </p>
                                    <p className="mt-1 text-lg font-semibold text-[#f4df95]">
                                      {donationImpact.label}
                                    </p>
                                    <p className="mt-2 text-xs leading-5 text-[#aebfaf]">
                                      Certificate:{" "}
                                      {selectedRequest.data.mwr_certificate_name ||
                                        getRequesterName(selectedRequest)}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="rounded-[20px] border border-[#40533f] bg-[#0d1510] p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#9cb499]">
                                  <Timer className="h-4 w-4" />
                                  Memo Preview
                                </p>
                                <span className="rounded-full border border-[#40533f] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[#cfd9d0]">
                                  4-hour countdown included
                                </span>
                              </div>
                              <pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-[18px] border border-[#2f4332] bg-black/30 p-3 text-xs leading-6 text-[#dce6dd]">
                                {protocolMemo}
                              </pre>
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => dispatchProtocolMemo(selectedRequest, "whatsapp")}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0d5f2a] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#127434]"
                              >
                                <RadioTower className="h-4 w-4" />
                                Send WhatsApp
                              </button>
                              <button
                                type="button"
                                onClick={() => dispatchProtocolMemo(selectedRequest, "email")}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1d4e89] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2562ac]"
                              >
                                <Mail className="h-4 w-4" />
                                Send Email
                              </button>
                            </div>

                            {getSocialEntries(selectedRequest).length > 0 && (
                              <div className="grid gap-2">
                                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9cb499]">
                                  Social Dispatch Paths
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {getSocialEntries(selectedRequest).map((entry) => (
                                    <button
                                      key={entry.key}
                                      type="button"
                                      onClick={() => dispatchSocialProtocolMemo(entry, selectedRequest)}
                                      className="inline-flex items-center gap-2 rounded-full border border-[#415540] bg-[#122015] px-3 py-2 text-xs font-semibold text-[#dde7de] transition hover:border-[#6f846b]"
                                    >
                                      <Send className="h-3.5 w-3.5" />
                                      {entry.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="grid gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                onClick={() => generateSupplyManifest(selectedRequest)}
                                disabled={selectedProtocol !== "SHOPPING"}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#596b4d] bg-[#172218] px-4 py-3 text-sm font-semibold text-[#dce6dd] transition hover:bg-[#213021] disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <Package className="h-4 w-4" />
                                Supply Manifest PDF
                              </button>
                              <button
                                type="button"
                                onClick={() => generateAppreciationCertificate(selectedRequest)}
                                disabled={selectedProtocol !== "MWR"}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#596b4d] bg-[#172218] px-4 py-3 text-sm font-semibold text-[#dce6dd] transition hover:bg-[#213021] disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                <ShieldCheck className="h-4 w-4" />
                                Certificate PDF
                              </button>
                            </div>

                            {protocolStatus && (
                              <p className="rounded-[16px] border border-[#344834] bg-black/20 px-3 py-2 text-xs leading-5 text-[#aebfaf]">
                                {protocolStatus}
                              </p>
                            )}
                          </div>
                        </article>

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
                                    className="break-all rounded-full border border-[#415540] bg-[#122015] px-3 py-2 text-xs font-semibold text-[#dde7de]"
                                  >
                                    {entry.label}: {entry.value}
                                  </a>
                                ) : (
                                  <span
                                    key={entry.key}
                                    className="break-all rounded-full border border-[#415540] bg-[#122015] px-3 py-2 text-xs font-semibold text-[#dde7de]"
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
                                    className="h-44 w-full rounded-[18px] border border-[#415540] object-cover sm:h-40"
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
                                    className="h-44 w-full rounded-[18px] border border-[#415540] object-cover sm:h-40"
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

"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  BriefcaseMedical,
  CalendarClock,
  CreditCard,
  FileImage,
  Fingerprint,
  Globe,
  MapPinned,
  UserRoundSearch,
  X,
} from "lucide-react";

import { firebaseDb, firebaseStorage } from "@/lib/firebase/client";
import { firebaseEnvErrorMessage } from "@/lib/firebase/config";
import { SERVICE_OPTIONS, type ServiceType } from "@/lib/support-requests";

interface MissionTourObject {
  country?: string;
  tour_start?: string;
  tour_end?: string;
  start?: string;
  end?: string;
}

interface MemberDocument {
  full_name?: string;
  rank?: string;
  email?: string;
  phone?: string;
  service_number?: string;
  branch?: string;
  unit?: string;
  status?: string;
  gallery_state?: {
    official_portrait_url?: string;
    tactical_photo_url?: string;
    certification_scans?: string[];
  };
  service_record?: {
    date_enrolled?: string;
    rank_history?: string[];
    mos_code?: string;
    mos_title?: string;
    total_deployments?: number;
    years_of_service?: number;
  };
  mission_geography?: Array<string | MissionTourObject>;
  medical_ledger?: {
    blood_type?: string;
    injury_history?: string;
    psych_eval_status?: string;
    current_medication?: string;
    records?: Array<{
      date?: string;
      event?: string;
      severity?: string;
      outcome?: string;
    }>;
  };
  payroll_benefits?: {
    base_pay?: number;
    hazard_pay_eligibility?: boolean;
    monthly_housing_allowance?: number;
    last_promotion_date?: string;
  };
}

interface MemberRecord {
  id: string;
  data: MemberDocument;
}

const CERT_PLACEHOLDERS = [
  "https://placehold.co/640x360/f8fafc/1f2937?text=Combat+Medic+Certification",
  "https://placehold.co/640x360/f8fafc/1f2937?text=Paratrooper+Wings+Scan",
];

const OFFICIAL_PLACEHOLDER =
  "https://placehold.co/640x420/111827/e5e7eb?text=Official+Portrait";
const FIELD_PLACEHOLDER = "https://placehold.co/640x420/111827/e5e7eb?text=Tactical+Field+Photo";

const REQUEST_STEPS = [
  "Mission Brief",
  "Requester Identity",
  "Contact Matrix",
  "Evidence & Submit",
] as const;

function formatCurrency(value: number | undefined) {
  if (typeof value !== "number") {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function calculateUrgency(type: ServiceType): "CRITICAL" | "MEDIUM" | "LOW" {
  if (type === "FLIGHT") {
    return "CRITICAL";
  }
  if (type === "CALL_TIME") {
    return "MEDIUM";
  }
  return "LOW";
}

function toMissionDisplay(value: string | MissionTourObject) {
  if (typeof value === "string") {
    return value;
  }

  const country = value.country ?? "Unknown location";
  const start = value.tour_start ?? value.start ?? "?";
  const end = value.tour_end ?? value.end ?? "?";
  return `${country} (${start} -> ${end})`;
}

function normalizeService(value: string | null): ServiceType | null {
  const upperValue = value?.toUpperCase();

  if (upperValue === "FLIGHT") {
    return "FLIGHT";
  }
  if (upperValue === "CALL_TIME") {
    return "CALL_TIME";
  }
  if (upperValue === "SHOPPING") {
    return "SHOPPING";
  }
  if (upperValue === "MWR") {
    return "MWR";
  }

  return null;
}

function compactRecord<T extends Record<string, string>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry.trim() !== ""),
  ) as Partial<T>;
}

function sanitizeStorageName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function DossierPageContent() {
  const firebaseUnavailable = !firebaseDb;
  const searchParams = useSearchParams();
  const requestedService = normalizeService(searchParams.get("service"));
  const prefilledMemberId = searchParams.get("memberId")?.trim() ?? "";

  const [securitySweep, setSecuritySweep] = useState(() => new Date());
  const [searchInput, setSearchInput] = useState(prefilledMemberId);
  const [searchStatus, setSearchStatus] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [member, setMember] = useState<MemberRecord | null>(null);

  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [modalStatus, setModalStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [requesterName, setRequesterName] = useState("");
  const [requesterRelationship, setRequesterRelationship] = useState("");
  const [requesterLocation, setRequesterLocation] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressPostalCode, setAddressPostalCode] = useState("");
  const [addressCountry, setAddressCountry] = useState("United States");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [alternateEmail, setAlternateEmail] = useState("");
  const [preferredChannel, setPreferredChannel] = useState("Primary Phone");
  const [whatsapp, setWhatsapp] = useState("");
  const [telegram, setTelegram] = useState("");
  const [signalHandle, setSignalHandle] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [notes, setNotes] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [frontImageUrl, setFrontImageUrl] = useState("");
  const [backImageUrl, setBackImageUrl] = useState("");
  const [frontImageFile, setFrontImageFile] = useState<File | null>(null);
  const [backImageFile, setBackImageFile] = useState<File | null>(null);
  const [frontImagePreview, setFrontImagePreview] = useState("");
  const [backImagePreview, setBackImagePreview] = useState("");

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecuritySweep(new Date());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (frontImagePreview) {
        URL.revokeObjectURL(frontImagePreview);
      }
    };
  }, [frontImagePreview]);

  useEffect(() => {
    return () => {
      if (backImagePreview) {
        URL.revokeObjectURL(backImagePreview);
      }
    };
  }, [backImagePreview]);

  const selectedServiceDetails = useMemo(() => {
    if (!selectedService) {
      return null;
    }
    return SERVICE_OPTIONS.find((service) => service.type === selectedService) ?? null;
  }, [selectedService]);

  const visibleServices = useMemo(() => {
    if (!requestedService) {
      return SERVICE_OPTIONS;
    }
    return SERVICE_OPTIONS.filter((service) => service.type === requestedService);
  }, [requestedService]);

  const missionGeography = member?.data.mission_geography ?? [];
  const medicalRecords = member?.data.medical_ledger?.records ?? [];
  const certificationScans = member?.data.gallery_state?.certification_scans;
  const certificationImages =
    certificationScans && certificationScans.length > 0 ? certificationScans : CERT_PLACEHOLDERS;

  const intakeSummary = useMemo(() => {
    return [
      requesterName,
      primaryPhone,
      primaryEmail,
      alternatePhone,
      alternateEmail,
      whatsapp,
      telegram,
      signalHandle,
      facebook,
      instagram,
      xHandle,
    ].some((value) => value.trim() !== "");
  }, [
    alternateEmail,
    alternatePhone,
    facebook,
    instagram,
    primaryEmail,
    primaryPhone,
    requesterName,
    signalHandle,
    telegram,
    whatsapp,
    xHandle,
  ]);

  const resetIntakeState = useCallback((memberRecord: MemberRecord) => {
    setModalStep(1);
    setModalStatus("");
    setRequesterName("");
    setRequesterRelationship("");
    setRequesterLocation("");
    setAddressLine1("");
    setAddressLine2("");
    setAddressCity("");
    setAddressState("");
    setAddressPostalCode("");
    setAddressCountry("United States");
    setPrimaryPhone(memberRecord.data.phone ?? "");
    setAlternatePhone("");
    setPrimaryEmail(memberRecord.data.email ?? "");
    setAlternateEmail("");
    setPreferredChannel("Primary Phone");
    setWhatsapp("");
    setTelegram("");
    setSignalHandle("");
    setFacebook("");
    setInstagram("");
    setXHandle("");
    setNotes("");
    setDocumentType("");
    setDocumentNumber("");
    setFrontImageUrl("");
    setBackImageUrl("");
    setFrontImageFile(null);
    setBackImageFile(null);
    if (frontImagePreview) {
      URL.revokeObjectURL(frontImagePreview);
    }
    if (backImagePreview) {
      URL.revokeObjectURL(backImagePreview);
    }
    setFrontImagePreview("");
    setBackImagePreview("");
  }, [backImagePreview, frontImagePreview]);

  const prepareModal = useCallback((serviceType: ServiceType, memberRecord: MemberRecord) => {
    setSelectedService(serviceType);
    setModalOpen(true);
    resetIntakeState(memberRecord);
  }, [resetIntakeState]);

  const runSearchWithTerm = useCallback(
    async (rawTerm: string) => {
      if (!firebaseDb) {
        setSearchStatus(firebaseEnvErrorMessage || "Firebase is not configured.");
        return;
      }

      const term = rawTerm.trim();
      if (!term) {
        setSearchStatus("Enter a service number or member email.");
        return;
      }

      setSearchBusy(true);
      setMember(null);
      setSearchStatus("Scanning member dossiers and command rosters...");

      try {
        const membersRef = collection(firebaseDb, "members");
        let snapshot = await getDocs(query(membersRef, where("service_number", "==", term), limit(1)));

        if (snapshot.empty) {
          snapshot = await getDocs(query(membersRef, where("email", "==", term), limit(1)));
        }

        if (snapshot.empty) {
          snapshot = await getDocs(
            query(membersRef, where("email", "==", term.toLowerCase()), limit(1)),
          );
        }

        if (snapshot.empty) {
          setSearchStatus("No member dossier matched that identifier.");
          return;
        }

        const document = snapshot.docs[0];
        const foundMember: MemberRecord = {
          id: document.id,
          data: document.data() as MemberDocument,
        };

        setMember(foundMember);
        setSearchStatus(
          `Verified dossier for ${document.data().full_name ?? document.id}. Secure review packet unlocked.`,
        );

        if (requestedService) {
          prepareModal(requestedService, foundMember);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        setSearchStatus(`Search failed: ${message}`);
      } finally {
        setSearchBusy(false);
      }
    },
    [prepareModal, requestedService],
  );

  async function runSearch() {
    await runSearchWithTerm(searchInput);
  }

  useEffect(() => {
    if (!prefilledMemberId) {
      return;
    }

    setSearchInput(prefilledMemberId);
    void runSearchWithTerm(prefilledMemberId);
  }, [prefilledMemberId, runSearchWithTerm]);

  function openRequestModal(serviceType: ServiceType) {
    if (!member) {
      setSearchStatus("Load a verified member dossier before opening a support request.");
      return;
    }

    prepareModal(serviceType, member);
  }

  function closeModal() {
    setModalOpen(false);
    setModalStep(1);
    setModalStatus("");
    setSubmitting(false);
  }

  function updateFileState(
    file: File | null,
    currentPreview: string,
    setFile: Dispatch<SetStateAction<File | null>>,
    setPreview: Dispatch<SetStateAction<string>>,
  ) {
    if (currentPreview) {
      URL.revokeObjectURL(currentPreview);
    }

    setFile(file);
    setPreview(file ? URL.createObjectURL(file) : "");
  }

  function handleFrontFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    updateFileState(file, frontImagePreview, setFrontImageFile, setFrontImagePreview);
  }

  function handleBackFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    updateFileState(file, backImagePreview, setBackImageFile, setBackImagePreview);
  }

  function hasReachableContact() {
    return [
      primaryPhone,
      alternatePhone,
      primaryEmail,
      alternateEmail,
      whatsapp,
      telegram,
      signalHandle,
      facebook,
      instagram,
      xHandle,
    ].some((value) => value.trim() !== "");
  }

  function goToNextStep() {
    setModalStatus("");

    if (modalStep === 1) {
      setModalStep(2);
      return;
    }

    if (modalStep === 2) {
      if (!requesterName.trim() || !requesterLocation.trim()) {
        setModalStatus("Enter the requester name and current location before continuing.");
        return;
      }

      setModalStep(3);
      return;
    }

    if (modalStep === 3) {
      if (!hasReachableContact()) {
        setModalStatus(
          "Provide at least one reachable phone, email, or social contact so logistics can respond.",
        );
        return;
      }

      setModalStep(4);
    }
  }

  async function uploadIdentificationAsset(
    file: File,
    memberId: string,
    slot: "front" | "back",
  ) {
    if (!firebaseStorage) {
      throw new Error("Firebase Storage is not configured for optional ID uploads.");
    }

    const stamp = Date.now();
    const path = `request-intake/${memberId}/${stamp}-${slot}-${sanitizeStorageName(file.name)}`;
    const storageRef = ref(firebaseStorage, path);
    try {
      await uploadBytes(storageRef, file, {
        contentType: file.type || "application/octet-stream",
      });
    } catch {
      throw new Error(
        "Firebase Storage is not initialized for direct ID uploads yet. Use the secure image URL field instead, or enable Firebase Storage before attaching image files.",
      );
    }

    return {
      url: await getDownloadURL(storageRef),
      name: file.name,
    };
  }

  async function submitRequest() {
    if (!member || !selectedServiceDetails || !firebaseDb) {
      if (!firebaseDb) {
        setModalStatus(firebaseEnvErrorMessage || "Firebase is not configured.");
      }
      return;
    }

    if (!requesterName.trim() || !requesterLocation.trim()) {
      setModalStatus("Requester identity is incomplete.");
      return;
    }

    if (!hasReachableContact()) {
      setModalStatus("Provide at least one reachable contact method before submitting.");
      return;
    }

    setSubmitting(true);
    setModalStatus("Preparing secure request packet...");

    try {
      let frontUploadedUrl = frontImageUrl.trim();
      let frontUploadedName = "";
      let backUploadedUrl = backImageUrl.trim();
      let backUploadedName = "";

      if (frontImageFile) {
        setModalStatus("Uploading front ID image...");
        const uploadedFront = await uploadIdentificationAsset(frontImageFile, member.id, "front");
        frontUploadedUrl = uploadedFront.url;
        frontUploadedName = uploadedFront.name;
      }

      if (backImageFile) {
        setModalStatus("Uploading back ID image...");
        const uploadedBack = await uploadIdentificationAsset(backImageFile, member.id, "back");
        backUploadedUrl = uploadedBack.url;
        backUploadedName = uploadedBack.name;
      }

      const requesterAddress = compactRecord({
        line1: addressLine1,
        line2: addressLine2,
        city: addressCity,
        state: addressState,
        postal_code: addressPostalCode,
        country: addressCountry,
      });

      const contact = compactRecord({
        primary_phone: primaryPhone,
        alternate_phone: alternatePhone,
        primary_email: primaryEmail,
        alternate_email: alternateEmail,
        preferred_channel: preferredChannel,
      });

      const socialContacts = compactRecord({
        whatsapp,
        telegram,
        signal: signalHandle,
        facebook,
        instagram,
        x: xHandle,
      });

      const identification = compactRecord({
        document_type: documentType,
        document_number: documentNumber,
        front_image_url: frontUploadedUrl,
        back_image_url: backUploadedUrl,
        front_image_name: frontUploadedName,
        back_image_name: backUploadedName,
      });

      const payload = {
        member_uid: member.id,
        member_name: member.data.full_name ?? "",
        member_rank: member.data.rank ?? "",
        member_email: member.data.email ?? "",
        member_phone: member.data.phone ?? "",
        requester_name: requesterName.trim(),
        requester_relationship: requesterRelationship.trim(),
        requester_location: requesterLocation.trim(),
        request_type: selectedServiceDetails.type,
        request_label: selectedServiceDetails.label,
        request_timestamp: serverTimestamp(),
        status: "UNREVIEWED" as const,
        urgency_level: calculateUrgency(selectedServiceDetails.type),
        notes: notes.trim(),
        channel: "PUBLIC_DOSSIER_PORTAL",
        ...(Object.keys(requesterAddress).length > 0 ? { requester_address: requesterAddress } : {}),
        ...(Object.keys(contact).length > 0 ? { contact } : {}),
        ...(Object.keys(socialContacts).length > 0 ? { social_contacts: socialContacts } : {}),
        ...(Object.keys(identification).length > 0 ? { identification } : {}),
      };

      setModalStatus("Routing request to Firestore command ledger...");
      await addDoc(collection(firebaseDb, "requests"), payload);

      setModalStatus("Support request submitted successfully.");
      window.setTimeout(() => {
        closeModal();
      }, 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setModalStatus(`Submission failed: ${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06110a] text-[#dce6d8]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,177,79,0.16),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(74,91,47,0.34),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.18),rgba(0,0,0,0.42))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(162,180,140,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(162,180,140,0.045)_1px,transparent_1px)] bg-[size:56px_56px] opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-[repeating-linear-gradient(135deg,#d6b14f_0,#d6b14f_18px,#101610_18px,#101610_36px)]" />

      <div className="relative mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="soft-outline panel-sheen mb-6 overflow-hidden rounded-[28px] border border-[#334531] bg-[linear-gradient(135deg,rgba(11,23,14,0.95),rgba(18,35,22,0.93))]">
          <div className="grid gap-4 border-b border-[#314332] px-5 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#d8b85a] sm:grid-cols-3 sm:px-7">
            <p>Controlled Unclassified Intake</p>
            <p className="sm:text-center">Family Support Verification Packet</p>
            <p className="sm:text-right">Last Security Sweep {securitySweep.toLocaleTimeString()}</p>
          </div>
          <div className="grid gap-5 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#95b48d]">
                Command Logistics / Dossier Access
              </p>
              <h1 className="font-display text-3xl font-semibold text-[#f1f5ef] sm:text-4xl lg:text-5xl">
                Personnel Dossier Portal
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#b8c8b6] sm:text-base">
                Verify member records, inspect operational history, and submit a structured support
                request packet with richer requester identity, contact, and documentation details.
              </p>
            </div>
            <div className="rounded-[24px] border border-[#364835] bg-black/25 px-5 py-4 text-sm text-[#dbe6d9]">
              <p className="font-semibold uppercase tracking-[0.15em] text-[#d6b14f]">
                Clearance Profile
              </p>
              <p className="mt-2">Confidential dossier preview</p>
              <p className="text-[#8da88a]">Support intake routed to logistics review</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-5 pb-6 sm:px-7">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-[#415440] bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Return Home
            </Link>
          </div>
        </header>

        {firebaseUnavailable && (
          <section className="soft-outline mb-6 rounded-[24px] border border-[#6e5c37] bg-[#231d12] p-5">
            <p className="text-sm text-[#f0d28a]">
              Firebase configuration is missing. {firebaseEnvErrorMessage}
            </p>
            <p className="mt-2 text-xs text-[#d0c4a2]">
              Ensure `.env.local` exists in the project root, then restart the dev server.
            </p>
          </section>
        )}

        <section className="soft-outline mb-6 overflow-hidden rounded-[28px] border border-[#304230] bg-[linear-gradient(135deg,rgba(13,23,16,0.96),rgba(19,31,22,0.94))]">
          <div className="grid gap-6 px-5 py-6 sm:px-7 xl:grid-cols-[1.2fr_0.8fr] xl:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#d6b14f]">
                Member Search Console
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-[#f0f5ee] sm:text-3xl">
                Verify A Service Record Before Opening Support Intake
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#aebfaf] sm:text-base">
                Query by official member ID or known email. Once the dossier is verified, support
                lanes open with a multi-step packet that captures requester identity, address,
                contact paths, and optional ID evidence.
              </p>
              {requestedService && (
                <p className="status-ring mt-4 inline-flex items-center gap-2 rounded-full bg-[#162219] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-[#d8ecda]">
                  Requested service:
                  <span className="text-[#f4d56a]">
                    {SERVICE_OPTIONS.find((service) => service.type === requestedService)?.label}
                  </span>
                </p>
              )}
            </div>
            <div className="rounded-[24px] border border-[#374936] bg-black/20 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#1c2c1e] text-[#d5b768]">
                  <UserRoundSearch className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#97b296]">
                    Search Dossier
                  </p>
                  <p className="text-sm text-[#dde7db]">
                    Use an issued service number or verified service email.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Service number or verified email"
                  className="min-w-[260px] flex-1 rounded-xl border border-[#445744] bg-[#0d1710] px-4 py-3 text-sm text-[#eef4ec] outline-none transition focus:border-[#d4b55a]"
                />
                <button
                  type="button"
                  disabled={searchBusy}
                  onClick={runSearch}
                  className="rounded-xl bg-[#d4b55a] px-5 py-3 text-sm font-semibold text-[#16200d] transition hover:bg-[#e2c46b] disabled:opacity-60"
                >
                  {searchBusy ? "Searching..." : "Open Dossier"}
                </button>
              </div>
              {searchStatus && <p className="mt-3 text-sm text-[#a9b8aa]">{searchStatus}</p>}
            </div>
          </div>
        </section>

        {member && (
          <section className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
            <aside className="soft-outline overflow-hidden rounded-[28px] border border-[#334631] bg-[linear-gradient(180deg,rgba(13,22,16,0.98),rgba(16,28,20,0.97))]">
              <div className="border-b border-[#314332] px-5 py-4 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b14f]">
                  Confidential Dossier
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-[#f1f6ef]">
                  {member.data.full_name ?? "Unknown Member"}
                </h2>
                <p className="mt-2 text-sm text-[#9fb39f]">
                  {member.data.rank ?? "-"} · {member.data.branch ?? "United States Army"}
                </p>
              </div>

              <div className="grid gap-4 px-5 py-5 sm:px-6">
                <article className="rounded-[24px] border border-[#364834] bg-black/20 p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#9cb499]">
                    Official Portrait
                  </p>
                  <img
                    src={member.data.gallery_state?.official_portrait_url ?? OFFICIAL_PLACEHOLDER}
                    alt="Official portrait"
                    className="h-72 w-full rounded-[20px] object-cover"
                  />
                </article>

                <article className="grid gap-3 rounded-[24px] border border-[#364834] bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9cb499]">
                      Identity Summary
                    </p>
                    <span className="rounded-full border border-[#4c604b] bg-[#152016] px-3 py-1 text-[0.68rem] font-bold uppercase tracking-[0.1em] text-[#d7e5d8]">
                      {member.data.status ?? "ACTIVE"}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-[#e5ece4]">
                    <p>
                      <span className="text-[#97ac97]">Service Number</span>
                      <br />
                      <span className="font-semibold">{member.data.service_number ?? member.id}</span>
                    </p>
                    <p>
                      <span className="text-[#97ac97]">Unit</span>
                      <br />
                      <span className="font-semibold">{member.data.unit ?? "-"}</span>
                    </p>
                    <p>
                      <span className="text-[#97ac97]">MOS</span>
                      <br />
                      <span className="font-semibold">
                        {member.data.service_record?.mos_code ?? "-"}{" "}
                        {member.data.service_record?.mos_title ?? ""}
                      </span>
                    </p>
                    <p>
                      <span className="text-[#97ac97]">Reachback Contact</span>
                      <br />
                      <span className="font-semibold">{member.data.email ?? "-"}</span>
                    </p>
                  </div>
                </article>

                <article className="rounded-[24px] border border-[#364834] bg-black/20 p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#9cb499]">
                    Tactical / Field Photo
                  </p>
                  <img
                    src={member.data.gallery_state?.tactical_photo_url ?? FIELD_PLACEHOLDER}
                    alt="Field photo"
                    className="h-48 w-full rounded-[20px] object-cover"
                  />
                </article>
              </div>
            </aside>

            <div className="grid gap-6">
              <section className="soft-outline overflow-hidden rounded-[28px] border border-[#334631] bg-[linear-gradient(180deg,rgba(12,21,14,0.98),rgba(15,28,19,0.96))]">
                <div className="border-b border-[#314332] px-5 py-4 sm:px-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b14f]">
                    Verified Personnel Record
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[#aebfaf]">
                    High-trust personnel snapshot compiled for logistics review and family support
                    coordination.
                  </p>
                </div>

                <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-2">
                  <article className="rounded-[22px] border border-[#364834] bg-black/20 p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[#d8b85a]">
                      <CalendarClock className="h-4 w-4" />
                      Service Record
                    </p>
                    <div className="mt-4 grid gap-3 text-sm text-[#e5ece4] sm:grid-cols-2">
                      <p>
                        <span className="text-[#97ac97]">Date Enrolled</span>
                        <br />
                        {member.data.service_record?.date_enrolled ?? "-"}
                      </p>
                      <p>
                        <span className="text-[#97ac97]">Years of Service</span>
                        <br />
                        {member.data.service_record?.years_of_service ?? "-"}
                      </p>
                      <p>
                        <span className="text-[#97ac97]">Total Deployments</span>
                        <br />
                        {member.data.service_record?.total_deployments ?? "-"}
                      </p>
                      <p>
                        <span className="text-[#97ac97]">Rank History</span>
                        <br />
                        {(member.data.service_record?.rank_history ?? []).join(" -> ") || "-"}
                      </p>
                    </div>
                  </article>

                  <article className="rounded-[22px] border border-[#364834] bg-black/20 p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[#d8b85a]">
                      <Globe className="h-4 w-4" />
                      Mission Geography
                    </p>
                    <ul className="mt-4 space-y-2 text-sm text-[#dfe7df]">
                      {missionGeography.length > 0 ? (
                        missionGeography.map((tour, index) => (
                          <li
                            key={`${toMissionDisplay(tour)}-${index}`}
                            className="rounded-xl border border-[#2f4130] bg-[#0e1711] px-3 py-2"
                          >
                            {toMissionDisplay(tour)}
                          </li>
                        ))
                      ) : (
                        <li className="rounded-xl border border-[#2f4130] bg-[#0e1711] px-3 py-2">
                          No mission tours on file.
                        </li>
                      )}
                    </ul>
                  </article>

                  <article className="rounded-[22px] border border-[#364834] bg-black/20 p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[#d8b85a]">
                      <BriefcaseMedical className="h-4 w-4" />
                      Medical Ledger
                    </p>
                    <div className="mt-4 space-y-2 text-sm text-[#e5ece4]">
                      <p>
                        <span className="text-[#97ac97]">Blood Type</span>
                        <br />
                        {member.data.medical_ledger?.blood_type ?? "-"}
                      </p>
                      <p>
                        <span className="text-[#97ac97]">Psych Eval Status</span>
                        <br />
                        {member.data.medical_ledger?.psych_eval_status ?? "-"}
                      </p>
                      <p>
                        <span className="text-[#97ac97]">Current Medication</span>
                        <br />
                        {member.data.medical_ledger?.current_medication ?? "-"}
                      </p>
                      <p>
                        <span className="text-[#97ac97]">Injury Summary</span>
                        <br />
                        {member.data.medical_ledger?.injury_history ?? "-"}
                      </p>
                    </div>
                    {medicalRecords.length > 0 && (
                      <div className="mt-4 rounded-[18px] border border-[#314332] bg-[#0d1510] p-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9cb499]">
                          Incident Records
                        </p>
                        <ul className="mt-3 space-y-2 text-xs leading-6 text-[#dbe4db]">
                          {medicalRecords.map((record, index) => (
                            <li key={`${record.date ?? "record"}-${index}`}>
                              <span className="font-semibold text-[#f0d67f]">
                                {record.date ?? "Unknown Date"} · {record.severity ?? "unknown"}
                              </span>
                              {": "}
                              {record.event ?? "No event detail"}
                              {record.outcome ? ` (${record.outcome})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>

                  <article className="rounded-[22px] border border-[#364834] bg-black/20 p-4">
                    <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-[#d8b85a]">
                      <CreditCard className="h-4 w-4" />
                      Payroll & Benefits
                    </p>
                    <div className="mt-4 grid gap-3 text-sm text-[#e5ece4] sm:grid-cols-2">
                      <p>
                        <span className="text-[#97ac97]">Base Pay</span>
                        <br />
                        {formatCurrency(member.data.payroll_benefits?.base_pay)}
                      </p>
                      <p>
                        <span className="text-[#97ac97]">Housing Allowance</span>
                        <br />
                        {formatCurrency(member.data.payroll_benefits?.monthly_housing_allowance)}
                      </p>
                      <p>
                        <span className="text-[#97ac97]">Hazard Pay Eligible</span>
                        <br />
                        {String(member.data.payroll_benefits?.hazard_pay_eligibility ?? "-")}
                      </p>
                      <p>
                        <span className="text-[#97ac97]">Last Promotion</span>
                        <br />
                        {member.data.payroll_benefits?.last_promotion_date ?? "-"}
                      </p>
                    </div>
                  </article>
                </div>
              </section>

              <section className="soft-outline overflow-hidden rounded-[28px] border border-[#334631] bg-[linear-gradient(180deg,rgba(12,21,14,0.98),rgba(17,31,22,0.96))]">
                <div className="border-b border-[#314332] px-5 py-4 sm:px-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b14f]">
                    Support Application Intake
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-[#f0f5ee]">
                    Logistics Request Lanes
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[#aebfaf]">
                    Open a structured support packet with requester identity, multi-channel contact
                    options, optional ID images, and operational notes for follow-up by the
                    logistics officer.
                  </p>
                </div>
                <div className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-2 xl:grid-cols-4">
                  {visibleServices.map((service) => (
                    <button
                      key={service.type}
                      type="button"
                      onClick={() => openRequestModal(service.type)}
                      className="group rounded-[24px] border border-[#40533f] bg-[linear-gradient(180deg,rgba(18,30,21,0.98),rgba(11,18,13,0.96))] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#d5b556]"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#1b2c1f] text-[#d7b95f]">
                          <service.icon className="h-5 w-5" />
                        </div>
                        <span className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[#9db59b]">
                          {calculateUrgency(service.type)}
                        </span>
                      </div>
                      <h4 className="mt-5 font-display text-2xl font-semibold text-[#eef4ec]">
                        {service.label}
                      </h4>
                      <p className="mt-3 text-sm leading-7 text-[#aebfaf]">{service.priorityNote}</p>
                      <p className="mt-4 text-sm font-semibold text-[#f0d67f]">
                        Open structured intake packet
                      </p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="soft-outline overflow-hidden rounded-[28px] border border-[#334631] bg-[linear-gradient(180deg,rgba(12,21,14,0.98),rgba(16,28,20,0.96))] px-5 py-5 sm:px-6">
                <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#d6b14f]">
                  <FileImage className="h-4 w-4" />
                  Certification Scans
                </p>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {certificationImages.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt="Certification scan"
                      className="h-36 w-full rounded-[22px] border border-[#364834] bg-[#0d1510] object-cover"
                    />
                  ))}
                </div>
              </section>
            </div>
          </section>
        )}
      </div>

      {modalOpen && selectedServiceDetails && member && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="soft-outline w-full max-w-5xl overflow-hidden rounded-[30px] border border-[#42563f] bg-[linear-gradient(180deg,#0d1710_0%,#132117_100%)]">
            <div className="border-b border-[#334631] bg-[repeating-linear-gradient(135deg,#d6b14f_0,#d6b14f_14px,#0f160f_14px,#0f160f_28px)] px-5 py-2 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-[#11170f] sm:px-6">
              Confidential Support Intake Packet
            </div>
            <div className="flex items-start justify-between gap-3 px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#97b296]">
                  Request Lane
                </p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-[#f0f5ee]">
                  {selectedServiceDetails.label}
                </h3>
                <p className="mt-2 text-sm leading-7 text-[#aec0af]">
                  {selectedServiceDetails.priorityNote}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#445744] bg-white/5 transition hover:bg-white/10"
                aria-label="Close request modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-2 border-y border-[#334631] bg-black/10 px-5 py-4 sm:grid-cols-4 sm:px-6">
              {REQUEST_STEPS.map((stepLabel, index) => {
                const stepNumber = index + 1;
                const active = modalStep === stepNumber;
                const completed = modalStep > stepNumber;

                return (
                  <div
                    key={stepLabel}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      active
                        ? "border-[#d4b55a] bg-[#1b2414] text-[#f4df95]"
                        : completed
                          ? "border-[#4e6b49] bg-[#132017] text-[#dce7dc]"
                          : "border-[#324533] bg-[#0d1610] text-[#8ca28c]"
                    }`}
                  >
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em]">
                      Step {stepNumber}
                    </p>
                    <p className="mt-1 font-semibold">{stepLabel}</p>
                  </div>
                );
              })}
            </div>

            <div className="max-h-[70dvh] overflow-y-auto px-5 py-5 sm:px-6">
              {modalStep === 1 && (
                <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
                  <article className="rounded-[24px] border border-[#364834] bg-black/20 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d6b14f]">
                      Mission Brief
                    </p>
                    <h4 className="mt-3 font-display text-2xl font-semibold text-[#f1f6ef]">
                      Support Packet For {member.data.full_name ?? member.id}
                    </h4>
                    <div className="mt-4 grid gap-3 text-sm text-[#dce6dc] sm:grid-cols-2">
                      <p>
                        <span className="text-[#95ad95]">Member ID</span>
                        <br />
                        {member.data.service_number ?? member.id}
                      </p>
                      <p>
                        <span className="text-[#95ad95]">Urgency Band</span>
                        <br />
                        {calculateUrgency(selectedServiceDetails.type)}
                      </p>
                      <p>
                        <span className="text-[#95ad95]">Branch / Unit</span>
                        <br />
                        {member.data.branch ?? "-"} · {member.data.unit ?? "-"}
                      </p>
                      <p>
                        <span className="text-[#95ad95]">Response Channel</span>
                        <br />
                        Routed to secure Firestore request ledger
                      </p>
                    </div>
                  </article>
                  <article className="rounded-[24px] border border-[#364834] bg-black/20 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d6b14f]">
                      Packet Contents
                    </p>
                    <ul className="mt-4 space-y-3 text-sm leading-7 text-[#dce6dc]">
                      <li>Requester identity and relationship to the service member</li>
                      <li>Home address and current location for follow-up routing</li>
                      <li>Primary, alternate, and social contact channels</li>
                      <li>Optional government ID details and image evidence</li>
                      <li>Operational notes visible to the logistics officer</li>
                    </ul>
                  </article>
                </section>
              )}

              {modalStep === 2 && (
                <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <article className="rounded-[24px] border border-[#364834] bg-black/20 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d6b14f]">
                      Requester Identity
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label htmlFor="requesterName" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#9cb499]">
                          Requester Name
                        </label>
                        <input
                          id="requesterName"
                          value={requesterName}
                          onChange={(event) => setRequesterName(event.target.value)}
                          className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                        />
                      </div>
                      <div>
                        <label htmlFor="requesterRelationship" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#9cb499]">
                          Relationship To Member
                        </label>
                        <input
                          id="requesterRelationship"
                          value={requesterRelationship}
                          onChange={(event) => setRequesterRelationship(event.target.value)}
                          placeholder="Spouse, parent, sibling, sponsor..."
                          className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="requesterLocation" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#9cb499]">
                          Current Location
                        </label>
                        <input
                          id="requesterLocation"
                          value={requesterLocation}
                          onChange={(event) => setRequesterLocation(event.target.value)}
                          placeholder="City, state, country or current operating area"
                          className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                        />
                      </div>
                    </div>
                  </article>

                  <article className="rounded-[24px] border border-[#364834] bg-black/20 p-5">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#d6b14f]">
                      <MapPinned className="h-4 w-4" />
                      Home Address
                    </p>
                    <div className="mt-4 grid gap-4">
                      <input
                        value={addressLine1}
                        onChange={(event) => setAddressLine1(event.target.value)}
                        placeholder="Street address"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <input
                        value={addressLine2}
                        onChange={(event) => setAddressLine2(event.target.value)}
                        placeholder="Apartment, suite, or unit (optional)"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <input
                          value={addressCity}
                          onChange={(event) => setAddressCity(event.target.value)}
                          placeholder="City"
                          className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                        />
                        <input
                          value={addressState}
                          onChange={(event) => setAddressState(event.target.value)}
                          placeholder="State / Province"
                          className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                        />
                        <input
                          value={addressPostalCode}
                          onChange={(event) => setAddressPostalCode(event.target.value)}
                          placeholder="Postal code"
                          className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                        />
                        <input
                          value={addressCountry}
                          onChange={(event) => setAddressCountry(event.target.value)}
                          placeholder="Country"
                          className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                        />
                      </div>
                    </div>
                  </article>
                </section>
              )}

              {modalStep === 3 && (
                <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <article className="rounded-[24px] border border-[#364834] bg-black/20 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d6b14f]">
                      Contact Matrix
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <input
                        value={primaryPhone}
                        onChange={(event) => setPrimaryPhone(event.target.value)}
                        placeholder="Primary phone"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <input
                        value={alternatePhone}
                        onChange={(event) => setAlternatePhone(event.target.value)}
                        placeholder="Alternate phone"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <input
                        value={primaryEmail}
                        onChange={(event) => setPrimaryEmail(event.target.value)}
                        placeholder="Primary email"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <input
                        value={alternateEmail}
                        onChange={(event) => setAlternateEmail(event.target.value)}
                        placeholder="Alternate email"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <div className="md:col-span-2">
                        <label htmlFor="preferredChannel" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#9cb499]">
                          Preferred Contact Channel
                        </label>
                        <select
                          id="preferredChannel"
                          value={preferredChannel}
                          onChange={(event) => setPreferredChannel(event.target.value)}
                          className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                        >
                          <option>Primary Phone</option>
                          <option>Alternate Phone</option>
                          <option>Primary Email</option>
                          <option>Alternate Email</option>
                          <option>WhatsApp</option>
                          <option>Telegram</option>
                          <option>Signal</option>
                          <option>Instagram</option>
                          <option>Facebook</option>
                          <option>X</option>
                        </select>
                      </div>
                    </div>
                  </article>

                  <article className="rounded-[24px] border border-[#364834] bg-black/20 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d6b14f]">
                      Social Contact Paths
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <input
                        value={whatsapp}
                        onChange={(event) => setWhatsapp(event.target.value)}
                        placeholder="WhatsApp number or link"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <input
                        value={telegram}
                        onChange={(event) => setTelegram(event.target.value)}
                        placeholder="Telegram handle or link"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <input
                        value={signalHandle}
                        onChange={(event) => setSignalHandle(event.target.value)}
                        placeholder="Signal handle or link"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <input
                        value={facebook}
                        onChange={(event) => setFacebook(event.target.value)}
                        placeholder="Facebook profile link"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <input
                        value={instagram}
                        onChange={(event) => setInstagram(event.target.value)}
                        placeholder="Instagram handle or link"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <input
                        value={xHandle}
                        onChange={(event) => setXHandle(event.target.value)}
                        placeholder="X handle or link"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                    </div>

                    <div className="mt-4">
                      <label htmlFor="requestNotes" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#9cb499]">
                        Operational Notes
                      </label>
                      <textarea
                        id="requestNotes"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Explain urgency, travel dates, delivery needs, or other support context."
                        className="h-32 w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                    </div>
                  </article>
                </section>
              )}

              {modalStep === 4 && (
                <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                  <article className="rounded-[24px] border border-[#364834] bg-black/20 p-5">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#d6b14f]">
                      <Fingerprint className="h-4 w-4" />
                      Optional ID Verification
                    </p>
                    <div className="mt-4 grid gap-4">
                      <input
                        value={documentType}
                        onChange={(event) => setDocumentType(event.target.value)}
                        placeholder="Document type (passport, driver's license, military dependent ID...)"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <input
                        value={documentNumber}
                        onChange={(event) => setDocumentNumber(event.target.value)}
                        placeholder="Document number (optional)"
                        className="w-full rounded-xl border border-[#445744] bg-[#0d1710] px-3 py-2.5 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                      />
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[20px] border border-[#364834] bg-[#0d1510] p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9cb499]">
                            Front ID Image
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFrontFileChange}
                            className="mt-3 block w-full text-xs text-[#cad6c9]"
                          />
                          <p className="mt-2 text-[0.7rem] text-[#8da58b]">
                            Upload if Firebase Storage is enabled, or paste a secure image link
                            below.
                          </p>
                          <input
                            value={frontImageUrl}
                            onChange={(event) => setFrontImageUrl(event.target.value)}
                            placeholder="Or paste secure image URL"
                            className="mt-3 w-full rounded-xl border border-[#445744] bg-[#101912] px-3 py-2 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                          />
                          {(frontImagePreview || frontImageUrl.trim()) && (
                            <img
                              src={frontImagePreview || frontImageUrl}
                              alt="Front ID preview"
                              className="mt-3 h-36 w-full rounded-xl object-cover"
                            />
                          )}
                        </div>
                        <div className="rounded-[20px] border border-[#364834] bg-[#0d1510] p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9cb499]">
                            Back ID Image
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleBackFileChange}
                            className="mt-3 block w-full text-xs text-[#cad6c9]"
                          />
                          <p className="mt-2 text-[0.7rem] text-[#8da58b]">
                            Upload if Firebase Storage is enabled, or paste a secure image link
                            below.
                          </p>
                          <input
                            value={backImageUrl}
                            onChange={(event) => setBackImageUrl(event.target.value)}
                            placeholder="Or paste secure image URL"
                            className="mt-3 w-full rounded-xl border border-[#445744] bg-[#101912] px-3 py-2 text-sm text-[#eef4ec] outline-none focus:border-[#d4b55a]"
                          />
                          {(backImagePreview || backImageUrl.trim()) && (
                            <img
                              src={backImagePreview || backImageUrl}
                              alt="Back ID preview"
                              className="mt-3 h-36 w-full rounded-xl object-cover"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="rounded-[24px] border border-[#364834] bg-black/20 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d6b14f]">
                      Submission Review
                    </p>
                    <div className="mt-4 grid gap-4 text-sm text-[#dfe7df]">
                      <div className="rounded-[20px] border border-[#324533] bg-[#0d1510] p-4">
                        <p className="font-semibold text-[#f1f6ef]">
                          {requesterName || "Requester name pending"} · {requesterRelationship || "Relationship pending"}
                        </p>
                        <p className="mt-1 text-[#9db39e]">
                          Current location: {requesterLocation || "Not provided"}
                        </p>
                        <p className="mt-1 text-[#9db39e]">
                          Contact ready: {intakeSummary ? "Yes" : "No"}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#324533] bg-[#0d1510] p-4">
                        <p className="font-semibold text-[#f1f6ef]">Address</p>
                        <p className="mt-2 text-[#cfd9d0]">
                          {[addressLine1, addressLine2, addressCity, addressState, addressPostalCode, addressCountry]
                            .filter((value) => value.trim() !== "")
                            .join(", ") || "No home address provided"}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#324533] bg-[#0d1510] p-4">
                        <p className="font-semibold text-[#f1f6ef]">Contact Lanes</p>
                        <p className="mt-2 text-[#cfd9d0]">
                          Preferred: {preferredChannel}
                        </p>
                        <p className="mt-1 text-[#9db39e]">
                          Phone: {primaryPhone || "-"} / {alternatePhone || "-"}
                        </p>
                        <p className="mt-1 text-[#9db39e]">
                          Email: {primaryEmail || "-"} / {alternateEmail || "-"}
                        </p>
                        <p className="mt-1 text-[#9db39e]">
                          Social: {[whatsapp, telegram, signalHandle, facebook, instagram, xHandle]
                            .filter((value) => value.trim() !== "")
                            .join(" · ") || "None added"}
                        </p>
                      </div>
                    </div>
                  </article>
                </section>
              )}

              {modalStatus && (
                <p
                  className={`mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                    modalStatus.toLowerCase().includes("failed")
                      ? "bg-red-950/50 text-red-200"
                      : "bg-emerald-950/50 text-emerald-200"
                  }`}
                >
                  {modalStatus.toLowerCase().includes("failed") ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" />
                  )}
                  {modalStatus}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#334631] px-5 py-5 sm:px-6">
              <button
                type="button"
                onClick={() => {
                  setModalStatus("");
                  setModalStep((previous) => Math.max(1, previous - 1));
                }}
                className="rounded-xl border border-[#445744] px-4 py-2.5 text-sm font-semibold text-[#dbe5da] transition hover:bg-white/5"
                disabled={modalStep === 1}
              >
                Back
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-[#445744] px-4 py-2.5 text-sm font-semibold text-[#dbe5da] transition hover:bg-white/5"
                >
                  Cancel
                </button>
                {modalStep < 4 ? (
                  <button
                    type="button"
                    onClick={goToNextStep}
                    className="rounded-xl bg-[#d4b55a] px-4 py-2.5 text-sm font-semibold text-[#16200d] transition hover:bg-[#e2c46b]"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitRequest}
                    disabled={submitting}
                    className="rounded-xl bg-[#2d7a40] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#36934e] disabled:opacity-60"
                  >
                    {submitting ? "Submitting..." : "Submit Request Packet"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function DossierPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#06110a] px-4 py-10 text-[#dce6d8]">
          <div className="mx-auto max-w-4xl rounded-[24px] border border-[#334631] bg-[#101912] p-6 text-sm">
            Loading personnel dossier...
          </div>
        </main>
      }
    >
      <DossierPageContent />
    </Suspense>
  );
}

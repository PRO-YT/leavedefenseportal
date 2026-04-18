import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const projectRoot = resolve(process.cwd());
const envPath = resolve(projectRoot, ".env.local");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(envPath);

const requiredKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

const missingKeys = requiredKeys.filter((key) => !process.env[key]);
if (missingKeys.length > 0) {
  throw new Error(`Missing required Firebase env vars: ${missingKeys.join(", ")}`);
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const firestoreSetupUrl = `https://console.cloud.google.com/datastore/setup?project=${firebaseConfig.projectId}`;

const memberId = "USM-SW-2011-8824";
const memberDocId = "member_usm_sw_2011_8824";

async function assertFirestoreDatabaseExists(projectId) {
  const endpoint =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/%28default%29/documents/members?pageSize=1`;

  let response;
  try {
    response = await fetch(endpoint);
  } catch {
    return;
  }

  if (response.status !== 404) {
    return;
  }

  throw new Error(
    `Cloud Firestore has not been created for project ${projectId}. Create the database first: ${firestoreSetupUrl}`,
  );
}

const missionGeography = [
  { country: "Afghanistan", tour_start: "2012-04-10", tour_end: "2013-01-23" },
  { country: "Jordan", tour_start: "2016-07-02", tour_end: "2017-02-28" },
  { country: "Iraq", tour_start: "2019-03-14", tour_end: "2019-12-19" },
  { country: "South Korea", tour_start: "2023-05-08", tour_end: "2024-01-12" },
];

const medicalRecords = [
  {
    date: "2013-09-14",
    event: "Blast concussion with severe blood loss",
    severity: "fatal-risk",
    outcome: "Stabilized and returned to limited duty",
  },
  {
    date: "2016-11-03",
    event: "Compound left tibia fracture during convoy rollover",
    severity: "critical",
    outcome: "Surgery + full mobility recovery",
  },
  {
    date: "2019-06-27",
    event: "Penetrating shrapnel injury (thoracic region)",
    severity: "fatal-risk",
    outcome: "Emergency field intervention; discharged after rehab",
  },
  {
    date: "2024-02-19",
    event: "Heat injury and dehydration episode",
    severity: "moderate",
    outcome: "Resolved with observation",
  },
];

const memberPayload = {
  full_name: "Sarah Williams",
  rank: "SFC",
  email: "sarah.williams@usm.army",
  phone: "+1 (555) 772-9304",
  service_number: memberId,
  branch: "United States Army",
  unit: "75th Ranger Regiment - Support Battalion",
  status: "ACTIVE",
  last_profile_update: "2026-04-16",
  gallery_state: {
    official_portrait_url: "/images/sarah-williams-portrait-seed.jpeg",
    tactical_photo_url: "/images/sarah-williams-field-seed.jpeg",
    certification_scans: [
      "https://placehold.co/640x360/f8fafc/1f2937?text=Combat+Medic+Certification",
      "https://placehold.co/640x360/f8fafc/1f2937?text=Paratrooper+Wings+Scan",
    ],
  },
  service_record: {
    date_enrolled: "2011-02-17",
    rank_history: ["PVT", "PFC", "SPC", "SGT", "SSG", "SFC"],
    mos_code: "68W",
    mos_title: "Combat Medic Specialist",
    total_deployments: 4,
    years_of_service: 15,
  },
  mission_geography: missionGeography,
  medical_ledger: {
    blood_type: "O+",
    injury_history:
      "2013 blast concussion (fatal-risk), 2016 tibia fracture, 2019 shrapnel injury (fatal-risk), 2024 heat injury.",
    psych_eval_status: "Cleared - 2026-01-11",
    current_medication: "None (as of 2026-04-16)",
    records: medicalRecords,
  },
  payroll_benefits: {
    base_pay: 5080,
    hazard_pay_eligibility: true,
    monthly_housing_allowance: 2420,
    last_promotion_date: "2025-11-01",
    special_duty_pay: 375,
  },
  created_at: serverTimestamp(),
  updated_at: serverTimestamp(),
  seeded_by: "codex-seed-script",
};

async function main() {
  try {
    await assertFirestoreDatabaseExists(firebaseConfig.projectId);

    const ref = doc(db, "members", memberDocId);
    const existing = await getDoc(ref);

    await setDoc(
      ref,
      {
        ...memberPayload,
        created_at: existing.exists()
          ? existing.data().created_at ?? serverTimestamp()
          : serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );

    console.log("Seeded member dossier successfully.");
    console.log(`Document ID: ${memberDocId}`);
    console.log(`Service Number / Member ID: ${memberId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to seed Sarah Williams member record.");
    console.error(message);
    console.error(`Firestore setup URL: ${firestoreSetupUrl}`);
    console.error(
      "If message includes 'Cloud Firestore API has not been used or is disabled', enable it in Google Cloud Console:",
    );
    console.error(
      "https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=military-e0207",
    );
    process.exit(1);
  }
}

await main();

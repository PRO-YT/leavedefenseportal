import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const projectRoot = resolve(process.cwd());
const envPath = resolve(projectRoot, ".env.local");
const memberDataPath = resolve(projectRoot, "scripts", "seed-data", "member-profile.json");

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

function loadJsonFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Seed data file was not found: ${filePath}`);
  }

  return JSON.parse(readFileSync(filePath, "utf8"));
}

function normalizeServiceNumber(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/^[^A-Za-z0-9]+/, "").replace(/\s+/g, "").toUpperCase();
}

function normalizeSeedAssetPath(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^(?:https?:)?\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }

  const normalizedPath = trimmed
    .replace(/\\/g, "/")
    .replace(/^public(?=\/)/i, "")
    .replace(/^\.\//, "");

  return normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
}

function normalizeSeedAssetArray(values) {
  const unique = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const normalized = normalizeSeedAssetPath(value);

    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      unique.push(normalized);
    }
  }

  return unique;
}

function normalizeSeedText(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeSeedTextArray(values) {
  const unique = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      unique.push(trimmed);
    }
  }

  return unique;
}

function normalizeSeedNumber(value) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [key, stripUndefinedDeep(entry)])
        .filter(([, entry]) => entry !== undefined),
    );
  }

  return value;
}

function normalizeGalleryState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  return {
    ...value,
    official_portrait_url: normalizeSeedAssetPath(value.official_portrait_url),
    tactical_photo_url: normalizeSeedAssetPath(value.tactical_photo_url),
    gallery_images: normalizeSeedAssetArray(value.gallery_images),
    certification_scans: normalizeSeedAssetArray(value.certification_scans),
  };
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

function normalizeSeedPayload(rawData) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    throw new Error("Seed data must be a JSON object.");
  }

  const documentId = String(rawData.document_id ?? "").trim();
  const serviceNumber = normalizeServiceNumber(String(rawData.service_number ?? ""));

  if (!documentId) {
    throw new Error("Seed data is missing required field: document_id");
  }

  if (!serviceNumber) {
    throw new Error("Seed data is missing required field: service_number");
  }

  const payload = { ...rawData };
  delete payload.document_id;
  payload.phone = typeof payload.phone === "string" ? payload.phone.trim() : payload.phone;
  payload.service_number = serviceNumber;
  payload.gallery_state = normalizeGalleryState(payload.gallery_state);
  payload.countries_visited = normalizeSeedTextArray(payload.countries_visited);
  payload.current_country = normalizeSeedText(payload.current_country);
  payload.current_mission_region = normalizeSeedText(payload.current_mission_region);
  payload.months_served_current_tour = normalizeSeedNumber(payload.months_served_current_tour);
  payload.months_remaining_current_tour = normalizeSeedNumber(payload.months_remaining_current_tour);
  const sanitizedPayload = stripUndefinedDeep(payload);

  return {
    documentId,
    serviceNumber,
    payload: sanitizedPayload,
  };
}

async function main() {
  try {
    await assertFirestoreDatabaseExists(firebaseConfig.projectId);

    const seedData = loadJsonFile(memberDataPath);
    const { documentId, serviceNumber, payload } = normalizeSeedPayload(seedData);
    const ref = doc(db, "members", documentId);
    const existing = await getDoc(ref);

    await setDoc(
      ref,
      {
        ...payload,
        service_number: serviceNumber,
        created_at: existing.exists()
          ? existing.data().created_at ?? serverTimestamp()
          : serverTimestamp(),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );

    console.log("Seeded member dossier successfully.");
    console.log(`Document ID: ${documentId}`);
    console.log(`Service Number / Member ID: ${serviceNumber}`);
    console.log(`Seed data source: ${memberDataPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to seed member record.");
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

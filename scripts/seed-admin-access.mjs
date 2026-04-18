import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const adminEmail =
  process.env.ADMIN_ACCESS_EMAIL?.trim() ||
  process.env.NEXT_PUBLIC_ADMIN_ACCESS_EMAIL?.trim() ||
  "awele131@gmail.com";
const adminPassword = process.env.ADMIN_ACCESS_PASSWORD?.trim();
const adminDisplayName = process.env.ADMIN_ACCESS_DISPLAY_NAME?.trim() || "Logistics Officer";

const missingKeys = [
  !apiKey && "NEXT_PUBLIC_FIREBASE_API_KEY",
  !adminEmail && "NEXT_PUBLIC_ADMIN_ACCESS_EMAIL",
  !adminPassword && "ADMIN_ACCESS_PASSWORD",
].filter(Boolean);

if (missingKeys.length > 0) {
  throw new Error(`Missing required env vars: ${missingKeys.join(", ")}`);
}

async function callIdentityToolkit(endpoint, payload, allowFailure = false) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (response.ok) {
    return data;
  }

  const message = data?.error?.message ?? `HTTP ${response.status}`;
  if (allowFailure) {
    return { error: message };
  }

  if (message === "OPERATION_NOT_ALLOWED") {
    throw new Error(
      "Email/password sign-in is disabled in Firebase Auth. Enable the Email/Password provider in Firebase Console, then rerun this script.",
    );
  }

  if (message === "CONFIGURATION_NOT_FOUND") {
    throw new Error(
      "Firebase Authentication is not initialized for this project. Open Firebase Console, go to Authentication, click Get started, enable the Email/Password provider, then rerun this script.",
    );
  }

  throw new Error(message);
}

function toFriendlyIdentityError(message) {
  if (message === "OPERATION_NOT_ALLOWED") {
    return "Email/password sign-in is disabled in Firebase Auth. Enable the Email/Password provider in Firebase Console, then rerun this script.";
  }

  if (message === "CONFIGURATION_NOT_FOUND") {
    return "Firebase Authentication is not initialized for this project. Open Firebase Console, go to Authentication, click Get started, enable the Email/Password provider, then rerun this script.";
  }

  return message;
}

async function ensureAdminUser() {
  const signUpResponse = await callIdentityToolkit(
    "accounts:signUp",
    {
      email: adminEmail,
      password: adminPassword,
      returnSecureToken: true,
    },
    true,
  );

  let idToken = signUpResponse.idToken;

  if (signUpResponse.error) {
    if (signUpResponse.error !== "EMAIL_EXISTS") {
      throw new Error(toFriendlyIdentityError(signUpResponse.error));
    }

    const signInResponse = await callIdentityToolkit(
      "accounts:signInWithPassword",
      {
        email: adminEmail,
        password: adminPassword,
        returnSecureToken: true,
      },
      true,
    );

    if (signInResponse.error) {
      throw new Error(
        `Admin auth user ${adminEmail} already exists, but the configured password did not work. Reset the password in Firebase Console or update ADMIN_ACCESS_PASSWORD in .env.local before rerunning this script.`,
      );
    }

    idToken = signInResponse.idToken;
    console.log(`Verified existing Firebase Auth user for ${adminEmail}.`);
  } else {
    console.log(`Created Firebase Auth user for ${adminEmail}.`);
  }

  await callIdentityToolkit("accounts:update", {
    idToken,
    displayName: adminDisplayName,
    returnSecureToken: true,
  });

  console.log(`Admin access is ready for ${adminEmail}.`);
  console.log(
    "Change it later by updating NEXT_PUBLIC_ADMIN_ACCESS_EMAIL and ADMIN_ACCESS_PASSWORD in .env.local, then rerunning npm run seed:admin.",
  );
}

await ensureAdminUser();

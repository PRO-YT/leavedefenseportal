import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { CredentialProfile, SessionUser } from "@/lib/types";

export const SESSION_COOKIE_NAME = "ldp_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 10;
const SESSION_SECRET = process.env.AUTH_SECRET ?? "development-only-session-secret";

interface SessionEnvelope {
  user: SessionUser;
  expiresAt: number;
}

function toSessionUser(profile: CredentialProfile | SessionUser): SessionUser {
  const {
    id,
    name,
    rank,
    email,
    unit,
    role,
    callsign,
    missionDesk,
    clearance,
    homeStation,
    leaveBalance,
  } = profile;

  return {
    id,
    name,
    rank,
    email,
    unit,
    role,
    callsign,
    missionDesk,
    clearance,
    homeStation,
    leaveBalance,
  };
}

function signPayload(payload: string) {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function encodeSession(profile: CredentialProfile | SessionUser) {
  const envelope: SessionEnvelope = {
    user: toSessionUser(profile),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };

  const payload = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

function decodeSession(rawValue: string | undefined) {
  if (!rawValue) {
    return null;
  }

  const [payload, signature] = rawValue.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload);

  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const envelope = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as SessionEnvelope;

    if (envelope.expiresAt <= Date.now()) {
      return null;
    }

    return envelope.user;
  } catch {
    return null;
  }
}

export const getSession = cache(async () => {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
});

export async function createSession(profile: CredentialProfile | SessionUser) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, encodeSession(profile), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  return session;
}

import { NextResponse } from "next/server";

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

function toIdentityToolkitErrorMessage(message: string | undefined) {
  if (message === "INVALID_ID_TOKEN" || message === "USER_NOT_FOUND") {
    return "Your secure session could not be verified. Sign in again.";
  }

  return "Unable to verify logistics access right now.";
}

export async function POST(request: Request) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const adminEmail = process.env.ADMIN_ACCESS_EMAIL?.trim();

  if (!apiKey || !adminEmail) {
    return NextResponse.json(
      {
        authorized: false,
        message: "Admin authorization is not configured for this deployment.",
      },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => null)) as { idToken?: string } | null;
  const idToken = payload?.idToken?.trim();

  if (!idToken) {
    return NextResponse.json(
      {
        authorized: false,
        message: "Missing secure session token.",
      },
      { status: 400 },
    );
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    },
  );

  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    users?: Array<{ email?: string }>;
  };

  if (!response.ok) {
    return NextResponse.json(
      {
        authorized: false,
        message: toIdentityToolkitErrorMessage(data.error?.message),
      },
      { status: 401 },
    );
  }

  const resolvedEmail = normalizeEmail(data.users?.[0]?.email);
  if (!resolvedEmail || resolvedEmail !== normalizeEmail(adminEmail)) {
    return NextResponse.json(
      {
        authorized: false,
        message: "This credential set is not authorized for logistics access.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    authorized: true,
  });
}

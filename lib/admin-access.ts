const FALLBACK_ADMIN_ACCESS_EMAIL = "awele131@gmail.com";

export const adminAccessEmail =
  process.env.NEXT_PUBLIC_ADMIN_ACCESS_EMAIL?.trim() || FALLBACK_ADMIN_ACCESS_EMAIL;

export function isAuthorizedAdminEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase() === adminAccessEmail.toLowerCase();
}

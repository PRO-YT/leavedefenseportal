const FALLBACK_ADMIN_PORTAL_PATH = "/logistics-review-cell";
export const LEGACY_ADMIN_PATH = "/admin";

function trimTrailingSlash(pathname: string) {
  if (pathname === "/") {
    return pathname;
  }

  return pathname.replace(/\/+$/, "") || "/";
}

export function normalizeAdminPortalPath(rawPath: string | undefined) {
  const value = rawPath?.trim();

  if (!value) {
    return FALLBACK_ADMIN_PORTAL_PATH;
  }

  const normalized = value.startsWith("/") ? value : `/${value}`;
  return trimTrailingSlash(normalized);
}

export const adminPortalPath = normalizeAdminPortalPath(process.env.ADMIN_PORTAL_PATH);

export function matchesAdminPortalPath(pathname: string) {
  return trimTrailingSlash(pathname) === adminPortalPath;
}

export function matchesLegacyAdminPath(pathname: string) {
  return trimTrailingSlash(pathname) === LEGACY_ADMIN_PATH;
}

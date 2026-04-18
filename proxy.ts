import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  LEGACY_ADMIN_PATH,
  adminPortalPath,
  matchesAdminPortalPath,
  matchesLegacyAdminPath,
} from "@/lib/admin-route";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/portal")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (matchesLegacyAdminPath(pathname) && adminPortalPath !== LEGACY_ADMIN_PATH) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (matchesAdminPortalPath(pathname) && adminPortalPath !== LEGACY_ADMIN_PATH) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = LEGACY_ADMIN_PATH;
    return NextResponse.rewrite(adminUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)"],
};

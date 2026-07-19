import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminRoles, authCookieName, customerRoles, decodeSession } from "@/lib/session-token";

// Optimistic, fast gate for the two panel trees. This does NOT replace the
// per-page checks in getSession()/requireModuleAccess() (auth.ts, permissions.ts) —
// those still verify is_active/deleted_at and allowed_modules against Supabase on
// every request. Proxy only stops obviously unauthenticated/wrong-role traffic
// before it renders, and never touches any other route (agent-hub, blog-seo,
// integrations, communication, accounting, etc. are unaffected by this file).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(request.cookies.get(authCookieName)?.value);
  const role = session?.role;

  if (pathname.startsWith("/hk-admin")) {
    if (!role || !adminRoles.includes(role)) {
      return NextResponse.redirect(new URL("/giris", request.url));
    }
  }

  if (pathname.startsWith("/musteri-paneli")) {
    const isStaffPreview = Boolean(role && adminRoles.includes(role) && request.nextUrl.searchParams.has("company"));
    if (!role || (!customerRoles.includes(role) && !isStaffPreview)) {
      return NextResponse.redirect(new URL("/giris", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/hk-admin/:path*", "/musteri-paneli/:path*"]
};

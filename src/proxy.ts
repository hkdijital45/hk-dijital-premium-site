import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminRoles, authCookieName, customerRoles, decodeSession } from "@/lib/session-token";

// The real login screen still lives at /digital-center (unchanged internal
// route — password-reset/admin-setup flows already hardcode redirects there,
// see ResetPasswordForm/SetupAdminForm/SuperAdminBootstrapForm). It is no
// longer linked from any public nav/footer. The only supported public entry
// point is a private, env-controlled path rewritten to it below.
const REAL_LOGIN_PATH = "/digital-center";
const LEGACY_LOGIN_PATHS = new Set(["/login", "/giris"]);

// Optimistic, fast gate for the two panel trees plus the private login
// entry. This does NOT replace the per-page checks in
// getSession()/requireModuleAccess() (auth.ts, permissions.ts) — those still
// verify is_active/deleted_at and allowed_modules against Supabase on every
// request. Proxy only stops obviously unauthenticated/wrong-role traffic
// before it renders, and never touches any other route (agent-hub, blog-seo,
// integrations, communication, accounting, etc. are unaffected by this file).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(request.cookies.get(authCookieName)?.value);
  const role = session?.role;

  // PRIVATE_ADMIN_LOGIN_PATH is intentionally read at request time (not
  // baked into the static `matcher` below, which Next.js requires to be a
  // build-time constant) so the real private path can be rotated by changing
  // one environment variable and redeploying, with no code/route changes.
  const privatePath = process.env.PRIVATE_ADMIN_LOGIN_PATH;
  if (privatePath && pathname === `/${privatePath.replace(/^\/+/, "")}`) {
    return NextResponse.rewrite(new URL(REAL_LOGIN_PATH, request.url));
  }

  // The hidden route is not the real security boundary (auth/role checks
  // below and in every server route still apply); it only stops the old,
  // previously-public login paths from being casually discoverable now that
  // no navigation links to them. Sessions that already exist are left alone
  // so an authenticated admin/staff member navigating back to these URLs
  // isn't bounced.
  if (LEGACY_LOGIN_PATHS.has(pathname) && !role) {
    return NextResponse.redirect(new URL("/", request.url));
  }

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
  matcher: [
    "/hk-admin/:path*",
    "/musteri-paneli/:path*",
    "/login",
    "/giris",
    // Broad catch-all so the arbitrary, env-controlled private login path
    // (unknown at build time, so it cannot be a literal matcher entry) is
    // still intercepted. Excludes API routes, static/image assets and
    // metadata files to keep proxy cheap on the routes that matter.
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"
  ]
};

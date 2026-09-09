import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { adminRoles, authCookieName, customerRoles, decodeSession } from "@/lib/session-token";
import { HIDDEN_ACCESS_COOKIE, findValidHiddenAccessSession } from "@/lib/hidden-access";
import { isAiWorkforceHost, resolveAiWorkforceHostPathname } from "@/lib/ai-workforce-schema";

// The real login screen still lives at /digital-center (unchanged internal
// route — password-reset/admin-setup flows already hardcode redirects there,
// see ResetPasswordForm/SetupAdminForm/SuperAdminBootstrapForm). It is no
// longer linked from any public nav/footer. The only supported public entry
// point is a private, env-controlled path rewritten to it below.
const REAL_LOGIN_PATH = "/digital-center";
const LEGACY_LOGIN_PATHS = new Set(["/login", "/giris"]);

// Secret Access Control Center: an additional gate in front of the real
// login system, not a replacement for it. A valid, unexpired, unrevoked
// hidden_access_sessions row (see src/lib/hidden-access.ts) must exist
// before any of these route trees render at all — otherwise the visitor is
// bounced to the public homepage with no hint that anything else exists
// there. This intentionally applies even to an already-logged-in admin/
// customer: the 1-hour secret-access session is independent of, and in
// front of, the normal (longer-lived) hk_auth_session cookie.
const SECRET_GATED_PREFIXES = ["/hk-admin", "/musteri-paneli", "/ai-workforce"];

function requiresSecretGate(pathname: string, privatePath?: string) {
  if (pathname === REAL_LOGIN_PATH) return true;
  if (privatePath && pathname === `/${privatePath.replace(/^\/+/, "")}`) return true;
  return SECRET_GATED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// Optimistic, fast gate for the two panel trees plus the private login
// entry. This does NOT replace the per-page checks in
// getSession()/requireModuleAccess() (auth.ts, permissions.ts) — those still
// verify is_active/deleted_at and allowed_modules against Supabase on every
// request. Proxy only stops obviously unauthenticated/wrong-role traffic
// before it renders, and never touches any other route (agent-hub, blog-seo,
// integrations, communication, accounting, etc. are unaffected by this file).
// Never runs against /api/* (excluded by the matcher below) — authenticated
// API routes rely on their own real getSession()/requireModuleAccess()
// checks, never on this URL-level gate, by design.
export async function proxy(request: NextRequest) {
  // ai.hkdijital.com.tr serves the HK AI Workforce product at clean URLs
  // (ai.hkdijital.com.tr/agents instead of .../ai-workforce/agents). This
  // only affects that one exact host — every check below (secret gate, role
  // checks) then runs against the *effective* (possibly rewritten) pathname,
  // so ai.hkdijital.com.tr gets the exact same protection as
  // www.hkdijital.com.tr/ai-workforce. The auth cookie is host-only (see
  // src/lib/auth.ts) and intentionally not shared across subdomains, so
  // /giris and /digital-center are never rewritten — otherwise a visitor
  // with no session on this subdomain could never reach a login page.
  const onAiWorkforceHost = isAiWorkforceHost(request.headers.get("host"));
  const originalPathname = request.nextUrl.pathname;
  const session = decodeSession(request.cookies.get(authCookieName)?.value);
  const role = session?.role;
  const privatePath = process.env.PRIVATE_ADMIN_LOGIN_PATH;

  // Bare "/" on this host must only resolve to the gated "/ai-workforce"
  // once the visitor is already authorized for it — otherwise the gate's
  // own failure redirect (target: "/") re-triggers the same gate forever
  // (ERR_TOO_MANY_REDIRECTS). Cheap role check first so this extra
  // Supabase lookup only ever runs for the one narrow case that needs it —
  // never for anonymous visitors or any other path/host.
  let aiWorkforceRootAuthorized = false;
  if (onAiWorkforceHost && originalPathname === "/" && role && adminRoles.includes(role)) {
    const secretToken = request.cookies.get(HIDDEN_ACCESS_COOKIE)?.value;
    aiWorkforceRootAuthorized = Boolean(secretToken && (await findValidHiddenAccessSession(secretToken)));
  }
  const pathname = onAiWorkforceHost ? resolveAiWorkforceHostPathname(originalPathname, aiWorkforceRootAuthorized, privatePath) : originalPathname;

  if (requiresSecretGate(pathname, privatePath)) {
    const secretToken = request.cookies.get(HIDDEN_ACCESS_COOKIE)?.value;
    const secretSession = secretToken ? await findValidHiddenAccessSession(secretToken) : null;
    if (!secretSession) {
      const url = new URL("/", request.url);
      url.searchParams.set("hk_return", pathname);
      return NextResponse.redirect(url);
    }
  }

  // PRIVATE_ADMIN_LOGIN_PATH is intentionally read at request time (not
  // baked into the static `matcher` below, which Next.js requires to be a
  // build-time constant) so the real private path can be rotated by changing
  // one environment variable and redeploying, with no code/route changes.
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

  if (pathname.startsWith("/hk-admin") || pathname.startsWith("/ai-workforce")) {
    if (!role || !adminRoles.includes(role)) {
      // The secret gate has already passed. On the AI host, /giris
      // would bounce an anonymous visitor straight back to the homepage.
      return NextResponse.redirect(new URL(onAiWorkforceHost ? REAL_LOGIN_PATH : "/giris", request.url));
    }
  }

  if (pathname.startsWith("/musteri-paneli")) {
    const isStaffPreview = Boolean(role && adminRoles.includes(role) && request.nextUrl.searchParams.has("company"));
    if (!role || (!customerRoles.includes(role) && !isStaffPreview)) {
      // The secret gate has already passed. On the AI host, /giris
      // would bounce an anonymous visitor straight back to the homepage.
      return NextResponse.redirect(new URL(onAiWorkforceHost ? REAL_LOGIN_PATH : "/giris", request.url));
    }
  }

  if (onAiWorkforceHost && pathname !== originalPathname) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.rewrite(url);
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

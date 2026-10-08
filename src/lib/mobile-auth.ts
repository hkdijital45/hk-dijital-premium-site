// Mobile (React Native / Expo Go) auth bridge — the HK Admin mobile app
// has no browser cookie jar, so it can't use the existing cookie-based
// getSession()/requireModuleAccess(). Instead it sends the EXACT SAME
// signed, stateless session string (encodeSession/decodeSession from
// session-token.ts — HMAC-SHA256, the same secret the web cookie uses) as
// an `Authorization: Bearer <token>` header. No new secret, no new
// signing scheme, no service-role key ever leaves the server.
import "server-only";
import { decodeSession, type AppSession } from "@/lib/session-token";
import { canAccessModule } from "@/lib/permissions";

export function getBearerSession(request: Request): AppSession | null {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return decodeSession(match[1]);
}

export function requireMobileModuleAccess(request: Request, moduleKey: string): AppSession | null {
  const session = getBearerSession(request);
  return canAccessModule(session, moduleKey) ? session : null;
}

export function requireMobileStaffSession(request: Request): AppSession | null {
  const session = getBearerSession(request);
  if (!session) return null;
  return ["admin", "yonetici", "editor", "sales"].includes(session.role) ? session : null;
}

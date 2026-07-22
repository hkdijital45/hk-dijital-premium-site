import { createHmac } from "crypto";
import { safeCompare } from "./secure-compare.ts";

export const adminCookieName = "hk_admin_session";
export const authCookieName = "hk_auth_session";

export type UserRole = "admin" | "yonetici" | "editor" | "musteri" | "sales" | "customer";

export type AppSession = {
  authUserId?: string;
  profileId?: string;
  email: string;
  role: UserRole;
  fullName?: string;
  companyId?: string | null;
  accessToken?: string;
  refreshToken?: string;
  allowedModules?: string[];
  mustChangePassword?: boolean;
};

export const adminRoles: UserRole[] = ["admin", "yonetici", "editor", "sales"];
export const customerRoles: UserRole[] = ["customer", "musteri"];

function sessionSecret() {
  const configured = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    // Refuse to sign or verify session cookies with a guessable, hardcoded
    // secret in production — that would let anyone forge an admin session.
    // Local/dev environments keep the fallback below for QA convenience.
    throw new Error("ADMIN_SESSION_SECRET veya SUPABASE_SERVICE_ROLE_KEY tanımlanmadan üretimde oturum imzalanamaz.");
  }
  return "local-development-session-secret";
}

function signPayload(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function encodeSession(session: AppSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function decodeSession(value?: string): AppSession | null {
  if (!value || !value.includes(".")) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  let expected: string;
  try {
    expected = signPayload(payload);
  } catch {
    // sessionSecret() only throws when production has no real secret
    // configured — treat that as "no valid session" (fail closed) instead
    // of crashing every request through the middleware.
    return null;
  }
  if (!safeCompare(signature, expected)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AppSession;
  } catch {
    return null;
  }
}

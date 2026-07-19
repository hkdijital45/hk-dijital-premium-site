import { createHmac, timingSafeEqual } from "crypto";

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
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "local-development-session-secret"
  );
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
  const expected = signPayload(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AppSession;
  } catch {
    return null;
  }
}

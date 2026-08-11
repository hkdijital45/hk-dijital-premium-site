import { randomBytes, scryptSync, createHash, timingSafeEqual } from "crypto";
import { supabaseRest } from "@/lib/supabase";
import { safeCompare } from "@/lib/secure-compare";

// Secret Access Control Center — shared crypto/device/rate-limit helpers.
// Framework-agnostic on purpose: called from both src/proxy.ts (Node
// middleware runtime) and regular route handlers, so nothing here reaches
// into next/headers or NextRequest directly — callers extract ip/UA/cookie
// themselves and pass plain strings in.

export const HIDDEN_ACCESS_COOKIE = "hk_secret_access_session";
export const HIDDEN_ACCESS_SESSION_TTL_SECONDS = 3600;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_FAILURES = 5;

// --- Secret hashing (scrypt, self-describing single-column format) --------
// No existing password-hashing utility exists in this repo (real user login
// goes through Supabase Auth's own hashing, never touched by app code) — per
// the task's own explicit fallback, this uses Node's built-in scrypt rather
// than adding a new dependency.

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

export function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(secret, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export function verifySecret(secret: string, stored: string | null | undefined): boolean {
  if (!secret || !stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = scryptSync(secret, salt, expected.length, { N: Number(nRaw), r: Number(rRaw), p: Number(pRaw) });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// A strong, easy-to-copy random secret for "generate for me" — 30 bits of
// base32-ish entropy per group, grouped for readability like a license key.
export function generateStrongSecret(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  const bytes = randomBytes(20);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out.match(/.{1,5}/g)!.join("-");
}

// --- Opaque bearer session token (never stored raw) ------------------------

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// --- Request metadata (framework-agnostic, plain-string in/out) -----------

export function extractClientIp(headers: Headers | Record<string, string | null>): string {
  const get = (name: string) => (headers instanceof Headers ? headers.get(name) : headers[name]) || "";
  const forwarded = get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 80);
  return (get("x-real-ip") || "unknown").slice(0, 80);
}

export function classifyDevice(userAgent: string): { deviceType: string; operatingSystem: string; browser: string } {
  const ua = userAgent || "";
  const deviceType = /Mobi|Android(?!.*Tablet)|iPhone/i.test(ua) ? "mobile" : /iPad|Tablet/i.test(ua) ? "tablet" : "desktop";
  const operatingSystem = /Windows/i.test(ua) ? "Windows"
    : /Mac OS X/i.test(ua) ? "macOS"
    : /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iPod/i.test(ua) ? "iOS"
    : /Linux/i.test(ua) ? "Linux"
    : "Bilinmiyor";
  const browser = /Edg\//i.test(ua) ? "Edge"
    : /Chrome\//i.test(ua) && !/Chromium/i.test(ua) ? "Chrome"
    : /Firefox\//i.test(ua) ? "Firefox"
    : /Safari\//i.test(ua) && !/Chrome/i.test(ua) ? "Safari"
    : "Bilinmiyor";
  return { deviceType, operatingSystem, browser };
}

// --- Audit log -------------------------------------------------------------

export type HiddenAccessEventType = "SUCCESS" | "FAILED" | "BLOCKED" | "SESSION_REVOKED" | "SESSION_LOGOUT" | "AUTHENTICATED_LINKED";

export async function logHiddenAccessEvent(entry: {
  eventType: HiddenAccessEventType;
  keyId?: string | null;
  sessionId?: string | null;
  authenticatedUserId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string | null;
  deviceName?: string | null;
  triggerMethod?: string | null;
  reasonCode?: string | null;
}) {
  const { deviceType, operatingSystem, browser } = classifyDevice(entry.userAgent || "");
  try {
    await supabaseRest("hidden_access_logs", {
      method: "POST",
      body: JSON.stringify({
        event_type: entry.eventType,
        key_id: entry.keyId || null,
        session_id: entry.sessionId || null,
        authenticated_user_id: entry.authenticatedUserId || null,
        ip_address: entry.ipAddress || null,
        user_agent: (entry.userAgent || "").slice(0, 500) || null,
        device_type: deviceType,
        operating_system: operatingSystem,
        browser,
        device_id: entry.deviceId || null,
        device_name: entry.deviceName || null,
        trigger_method: entry.triggerMethod || null,
        reason_code: entry.reasonCode || null
      })
    });
  } catch (error) {
    // Never let audit logging failure block the actual security decision.
    console.error("hidden_access_logs insert failed:", error instanceof Error ? error.message : error);
  }
}

// --- Rate limiting (database-backed, Vercel is stateless) ------------------

export async function isIpRateLimited(ipAddress: string): Promise<boolean> {
  if (!ipAddress || ipAddress === "unknown") return false;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();
  try {
    const rows = await supabaseRest<Array<{ id: string }>>(
      `hidden_access_logs?ip_address=eq.${encodeURIComponent(ipAddress)}&event_type=in.(FAILED,BLOCKED)&created_at=gte.${encodeURIComponent(since)}&select=id&limit=${RATE_LIMIT_MAX_FAILURES}`
    );
    return rows.length >= RATE_LIMIT_MAX_FAILURES;
  } catch {
    // Fail open on infra errors — an outage of the logs table must not
    // itself become a way to lock every real user out of the gate.
    return false;
  }
}

// --- Session lookup (used by proxy.ts and by admin/session APIs) ----------

export type HiddenAccessSessionRow = {
  id: string;
  key_id: string | null;
  session_token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  authenticated_user_id: string | null;
  authenticated_at: string | null;
  device_id: string | null;
  device_name: string | null;
};

export async function findValidHiddenAccessSession(token: string): Promise<HiddenAccessSessionRow | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  try {
    const rows = await supabaseRest<HiddenAccessSessionRow[]>(
      `hidden_access_sessions?session_token_hash=eq.${tokenHash}&select=id,key_id,session_token_hash,expires_at,revoked_at,authenticated_user_id,authenticated_at,device_id,device_name&limit=1`
    );
    const row = rows[0];
    if (!row) return null;
    if (row.revoked_at) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;
    return row;
  } catch {
    // Fail closed: if we cannot verify a session, treat it as absent rather
    // than letting a Supabase hiccup silently grant access.
    return null;
  }
}

// Re-exported for callers that need constant-time comparison of raw tokens
// (not currently needed since lookup is by hash equality in SQL, kept for
// completeness/parity with the rest of the codebase's secret-comparison
// convention).
export { safeCompare };

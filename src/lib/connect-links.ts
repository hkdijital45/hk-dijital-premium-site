// HK Connect remote connection links — public.customer_connect_tokens
// (supabase/migrations/20260917_customer_connect_tokens.sql,
// 20260917_connect_token_capabilities.sql). Only a SHA-256 hash of the
// token is ever stored; the raw token exists only in the URL handed to
// the customer and in this module's return value at creation time —
// never logged, never re-derivable from the DB.
import crypto from "crypto";
import { supabaseRest } from "@/lib/supabase";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const CONNECT_CAPABILITIES = ["facebook", "instagram", "meta_ads", "google_ads", "ga4", "search_console"] as const;
export type ConnectCapability = (typeof CONNECT_CAPABILITIES)[number];
export const META_CAPABILITIES: ConnectCapability[] = ["facebook", "instagram", "meta_ads"];
export const GOOGLE_CAPABILITIES: ConnectCapability[] = ["google_ads", "ga4", "search_console"];

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export type ConnectLink = {
  id: string;
  company_id: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
  requested_capabilities: string[];
  completed_capabilities: string[];
};

export async function createConnectLink(companyId: string, createdBy: string | null, requestedCapabilities: ConnectCapability[]): Promise<{ token: string; link: ConnectLink }> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const rows = await supabaseRest<ConnectLink[]>("customer_connect_tokens", {
    method: "POST",
    body: JSON.stringify({
      company_id: companyId,
      token_hash: hashToken(rawToken),
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      created_by: createdBy,
      requested_capabilities: requestedCapabilities
    })
  });
  return { token: rawToken, link: rows[0] };
}

export async function listConnectLinks(companyId: string, limit = 10): Promise<ConnectLink[]> {
  return supabaseRest<ConnectLink[]>(
    `customer_connect_tokens?company_id=eq.${encodeURIComponent(companyId)}&select=id,company_id,expires_at,used_at,revoked_at,created_at,requested_capabilities,completed_capabilities&order=created_at.desc&limit=${limit}`
  );
}

export async function revokeConnectLink(id: string, companyId: string): Promise<boolean> {
  const rows = await supabaseRest<ConnectLink[]>(
    `customer_connect_tokens?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=id`,
    { method: "PATCH", body: JSON.stringify({ revoked_at: new Date().toISOString() }) }
  );
  return Boolean(rows[0]);
}

export type ConnectTokenValidation =
  | { valid: true; id: string; companyId: string; requestedCapabilities: string[]; completedCapabilities: string[] }
  | { valid: false; reason: "NOT_FOUND" | "EXPIRED" | "REVOKED" | "USED" };

/** A link is only ever "used" (fully done) once every requested capability
 * is complete — validated here, not just by used_at, so a partially
 * completed multi-provider link stays usable for its remaining pending
 * capabilities even if used_at hasn't been set yet by a race. */
export async function validateConnectToken(rawToken: string): Promise<ConnectTokenValidation> {
  if (!rawToken) return { valid: false, reason: "NOT_FOUND" };
  const rows = await supabaseRest<Array<{ id: string; company_id: string; expires_at: string; used_at: string | null; revoked_at: string | null; requested_capabilities: string[]; completed_capabilities: string[] }>>(
    `customer_connect_tokens?token_hash=eq.${hashToken(rawToken)}&select=id,company_id,expires_at,used_at,revoked_at,requested_capabilities,completed_capabilities&limit=1`
  );
  const row = rows[0];
  if (!row) return { valid: false, reason: "NOT_FOUND" };
  if (row.revoked_at) return { valid: false, reason: "REVOKED" };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { valid: false, reason: "EXPIRED" };
  const requested = row.requested_capabilities || [];
  const completed = row.completed_capabilities || [];
  const allDone = requested.length > 0 && requested.every((c) => completed.includes(c));
  if (row.used_at || allDone) return { valid: false, reason: "USED" };
  return { valid: true, id: row.id, companyId: row.company_id, requestedCapabilities: requested, completedCapabilities: completed };
}

/** Marks one or more requested capabilities complete for a link (e.g. all
 * of META_CAPABILITIES once a Meta asset selection is saved). Never
 * un-marks. Sets used_at only once every requested capability is done —
 * completing Google never blocks a still-pending Meta request and vice
 * versa. */
export async function markCapabilitiesComplete(id: string, capabilities: ConnectCapability[]): Promise<void> {
  const rows = await supabaseRest<Array<{ requested_capabilities: string[]; completed_capabilities: string[] }>>(
    `customer_connect_tokens?id=eq.${encodeURIComponent(id)}&select=requested_capabilities,completed_capabilities&limit=1`
  );
  const row = rows[0];
  if (!row) return;
  const requested = row.requested_capabilities || [];
  const nextCompleted = Array.from(new Set([...(row.completed_capabilities || []), ...capabilities.filter((c) => requested.includes(c))]));
  const allDone = requested.length > 0 && requested.every((c) => nextCompleted.includes(c));
  await supabaseRest(`customer_connect_tokens?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ completed_capabilities: nextCompleted, ...(allDone ? { used_at: new Date().toISOString() } : {}) })
  });
}

/** Public-safe company display info for the connect landing page — name
 * only, never anything from customer_integrations. */
export async function getCompanyDisplayName(companyId: string): Promise<string | null> {
  const rows = await supabaseRest<Array<{ name: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=name&limit=1`);
  return rows[0]?.name || null;
}

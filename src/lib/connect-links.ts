// HK Connect remote connection links — public.customer_connect_tokens
// (supabase/migrations/20260917_customer_connect_tokens.sql). Only a
// SHA-256 hash of the token is ever persisted; the raw token exists only
// in the URL handed to the customer and in this module's return value at
// creation time — never logged, never re-derivable from the DB.
import crypto from "crypto";
import { supabaseRest } from "@/lib/supabase";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

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
};

export async function createConnectLink(companyId: string, createdBy: string | null): Promise<{ token: string; link: ConnectLink }> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const rows = await supabaseRest<ConnectLink[]>("customer_connect_tokens", {
    method: "POST",
    body: JSON.stringify({
      company_id: companyId,
      token_hash: hashToken(rawToken),
      expires_at: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      created_by: createdBy
    })
  });
  return { token: rawToken, link: rows[0] };
}

export async function listConnectLinks(companyId: string, limit = 10): Promise<ConnectLink[]> {
  return supabaseRest<ConnectLink[]>(
    `customer_connect_tokens?company_id=eq.${encodeURIComponent(companyId)}&select=id,company_id,expires_at,used_at,revoked_at,created_at&order=created_at.desc&limit=${limit}`
  );
}

export async function revokeConnectLink(id: string, companyId: string): Promise<boolean> {
  const rows = await supabaseRest<ConnectLink[]>(
    `customer_connect_tokens?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&select=id`,
    { method: "PATCH", body: JSON.stringify({ revoked_at: new Date().toISOString() }) }
  );
  return Boolean(rows[0]);
}

export type ConnectTokenValidation = { valid: true; id: string; companyId: string } | { valid: false; reason: "NOT_FOUND" | "EXPIRED" | "REVOKED" | "USED" };

export async function validateConnectToken(rawToken: string): Promise<ConnectTokenValidation> {
  if (!rawToken) return { valid: false, reason: "NOT_FOUND" };
  const rows = await supabaseRest<Array<{ id: string; company_id: string; expires_at: string; used_at: string | null; revoked_at: string | null }>>(
    `customer_connect_tokens?token_hash=eq.${hashToken(rawToken)}&select=id,company_id,expires_at,used_at,revoked_at&limit=1`
  );
  const row = rows[0];
  if (!row) return { valid: false, reason: "NOT_FOUND" };
  if (row.revoked_at) return { valid: false, reason: "REVOKED" };
  if (row.used_at) return { valid: false, reason: "USED" };
  if (new Date(row.expires_at).getTime() <= Date.now()) return { valid: false, reason: "EXPIRED" };
  return { valid: true, id: row.id, companyId: row.company_id };
}

export async function consumeConnectToken(id: string): Promise<void> {
  await supabaseRest(`customer_connect_tokens?id=eq.${encodeURIComponent(id)}&used_at=is.null&revoked_at=is.null`, {
    method: "PATCH",
    body: JSON.stringify({ used_at: new Date().toISOString() })
  });
}

/** Public-safe company display info for the connect landing page — name
 * only, never anything from customer_integrations. */
export async function getCompanyDisplayName(companyId: string): Promise<string | null> {
  const rows = await supabaseRest<Array<{ name: string }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=name&limit=1`);
  return rows[0]?.name || null;
}

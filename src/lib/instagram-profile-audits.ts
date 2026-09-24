// Instagram Profil Optimizasyonu — context gathering + schema-validated
// save/read for the "HK Dijital — Instagram Profil Optimizasyonu" Claude
// Project. Mirrors the same pattern already used by
// marketing-intelligence/ads-strategy.ts and pre-audit/reports.ts: EXPORT
// = RENDER for context, explicit-approval-only save, history never
// overwritten. No AI call happens here — this file only reads real,
// already-connected HK Digital Center data and persists what Claude
// already produced and the user already approved.
import { supabaseRest } from "@/lib/supabase";
import { getCustomerIntegrations, type IntegrationStatus } from "@/lib/marketing-intelligence/customers";

export const INSTAGRAM_PROFILE_AUDITS_TABLE = "instagram_profile_audits";

export const INSTAGRAM_PROFILE_AUDIT_STATUSES = ["draft", "approved", "completed"] as const;
export type InstagramProfileAuditStatus = (typeof INSTAGRAM_PROFILE_AUDIT_STATUSES)[number];

export const INSTAGRAM_PROFILE_AUDIT_STATUS_LABELS: Record<InstagramProfileAuditStatus, string> = {
  draft: "Taslak",
  approved: "Onaylandı",
  completed: "Tamamlandı"
};

export type InstagramProfileAudit = {
  id: string;
  company_id: string;
  instagram_username: string;
  audit_date: string;
  status: InstagramProfileAuditStatus;
  overall_summary: string;
  profile_photo_analysis: unknown;
  username_analysis: unknown;
  name_field_analysis: unknown;
  current_bio: string;
  recommended_bio: string;
  link_cta_analysis: unknown;
  highlights_analysis: unknown;
  pinned_posts_analysis: unknown;
  profile_visual_analysis: unknown;
  trust_contact_analysis: unknown;
  priorities: unknown;
  checklist: unknown;
  previous_audit_id: string | null;
  source: string;
  metadata: unknown;
  raw_analysis: unknown;
  created_at: string;
  updated_at: string;
};

export type InstagramProfileAuditListItem = Pick<InstagramProfileAudit, "id" | "audit_date" | "status" | "instagram_username" | "overall_summary" | "created_at">;

export class InstagramProfileAuditNotFoundError extends Error {}
export class InstagramProfileAuditValidationError extends Error {}

function req(condition: unknown, message: string) {
  if (!condition) throw new InstagramProfileAuditValidationError(message);
}

/** Real, connected Instagram username for this company — read from the
 * OAuth-connected instagram_business asset (see customer-integration-
 * oauth.ts's saveMetaPhase1Integration), never guessed. Falls back to the
 * company's own manually-entered `instagram` field (companies.instagram)
 * only when no OAuth-connected asset exists, so a username is still shown
 * even before the customer connects via HK Connect. */
async function connectedInstagramUsername(companyId: string): Promise<{ username: string | null; source: "oauth" | "manual" | "none" }> {
  const rows = await supabaseRest<Array<{ integration_assets: unknown }>>(
    `customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&provider=eq.meta&select=integration_assets&limit=1`
  );
  const assets: any[] = Array.isArray(rows[0]?.integration_assets) ? (rows[0]!.integration_assets as any[]) : [];
  const igAsset = assets.find((item) => (item?.asset_type === "instagram_business" || item?.account_type === "instagram_business") && String(item?.status || item?.oauth_status || "").startsWith("connected"));
  const username = igAsset?.metadata?.username || null;
  if (username) return { username, source: "oauth" };

  const companies = await supabaseRest<Array<{ instagram: string | null }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=instagram&limit=1`);
  const manual = companies[0]?.instagram || null;
  return { username: manual ? manual.replace(/^@/, "") : null, source: manual ? "manual" : "none" };
}

export type InstagramProfileAuditContext = {
  company: { id: string; name: string; sector: string | null; city: string | null; website: string | null };
  instagram: {
    username: string | null;
    usernameSource: "oauth" | "manual" | "none";
    connectionStatus: IntegrationStatus;
  };
  latestAudit: InstagramProfileAuditListItem | null;
};

/** Single, compact call for everything Claude needs to start a profile
 * audit — real company/Instagram identity + the last saved audit (so
 * Claude can compare), never hundreds of raw rows and never fabricated
 * Instagram data this app has no real access to. */
export async function getInstagramProfileAuditContext(companyId: string): Promise<InstagramProfileAuditContext> {
  const [companies, integrations, instagram] = await Promise.all([
    supabaseRest<Array<{ id: string; name: string; sector: string | null; city: string | null; website: string | null }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id,name,sector,city,website&limit=1`),
    getCustomerIntegrations(companyId),
    connectedInstagramUsername(companyId)
  ]);
  const company = companies[0];
  if (!company) throw new InstagramProfileAuditNotFoundError(`company_id doğrulanamadı: ${companyId}`);

  const [latest] = await supabaseRest<InstagramProfileAuditListItem[]>(
    `${INSTAGRAM_PROFILE_AUDITS_TABLE}?company_id=eq.${encodeURIComponent(companyId)}&select=id,audit_date,status,instagram_username,overall_summary,created_at&order=audit_date.desc,created_at.desc&limit=1`
  );

  return {
    company,
    instagram: { username: instagram.username, usernameSource: instagram.source, connectionStatus: integrations.instagram },
    latestAudit: latest || null
  };
}

const AUDIT_JSONB_FIELDS = [
  "profile_photo_analysis", "username_analysis", "name_field_analysis", "link_cta_analysis",
  "highlights_analysis", "pinned_posts_analysis", "profile_visual_analysis", "trust_contact_analysis",
  "priorities", "checklist", "metadata", "raw_analysis"
] as const;

export type SaveInstagramProfileAuditInput = {
  companyId: string;
  instagramUsername: string;
  status?: InstagramProfileAuditStatus;
  overallSummary: string;
  currentBio?: string;
  recommendedBio?: string;
} & Partial<Record<(typeof AUDIT_JSONB_FIELDS)[number], unknown>>;

function validateSaveInput(input: unknown): SaveInstagramProfileAuditInput {
  const s = input as Partial<SaveInstagramProfileAuditInput>;
  req(s && typeof s === "object", "Rapor bir nesne olmalıdır.");
  req(typeof s.companyId === "string" && s.companyId, "companyId zorunludur.");
  req(typeof s.instagramUsername === "string" && s.instagramUsername.trim(), "instagramUsername zorunludur.");
  req(typeof s.overallSummary === "string" && s.overallSummary.trim().length > 10, "overallSummary zorunludur (en az 10 karakter).");
  if (s.status !== undefined) req(INSTAGRAM_PROFILE_AUDIT_STATUSES.includes(s.status as InstagramProfileAuditStatus), "status draft/approved/completed olmalıdır.");
  return s as SaveInstagramProfileAuditInput;
}

/** Persists an explicitly-approved profile audit. ALWAYS inserts a new
 * row — history is never overwritten (see task's "geçmiş raporları
 * koru" requirement) — and automatically links previous_audit_id to
 * whatever was this company's own latest row at save time, so a future
 * analysis can walk the chain back without the client having to know or
 * supply that id itself. company_id is verified against a real company
 * row before any write — never silently creates a report for an
 * unknown company. */
export async function saveInstagramProfileAudit(rawInput: unknown): Promise<InstagramProfileAudit> {
  const input = validateSaveInput(rawInput);
  const companies = await supabaseRest<Array<{ id: string }>>(`companies?id=eq.${encodeURIComponent(input.companyId)}&select=id&limit=1`);
  if (!companies.length) throw new InstagramProfileAuditNotFoundError(`company_id doğrulanamadı: ${input.companyId}`);

  const [previous] = await supabaseRest<Array<{ id: string }>>(
    `${INSTAGRAM_PROFILE_AUDITS_TABLE}?company_id=eq.${encodeURIComponent(input.companyId)}&select=id&order=audit_date.desc,created_at.desc&limit=1`
  );

  const row: Record<string, unknown> = {
    company_id: input.companyId,
    instagram_username: input.instagramUsername.trim().replace(/^@/, ""),
    status: input.status || "draft",
    overall_summary: input.overallSummary,
    current_bio: input.currentBio || "",
    recommended_bio: input.recommendedBio || "",
    previous_audit_id: previous?.id || null,
    source: "claude_mcp"
  };
  for (const field of AUDIT_JSONB_FIELDS) {
    if (input[field] !== undefined) row[field] = input[field];
  }

  const created = await supabaseRest<InstagramProfileAudit[]>(INSTAGRAM_PROFILE_AUDITS_TABLE, { method: "POST", body: JSON.stringify(row) });
  return created[0];
}

/** Compact history list (list view — never the heavy JSONB analysis
 * fields, matching the task's token-efficiency requirement) or, with
 * `id`, the one full audit — verified to actually belong to `companyId`
 * so one company's report can never be returned in another company's
 * context (company isolation). */
export async function getInstagramProfileAudits(companyId: string, options: { id?: string; limit?: number } = {}): Promise<InstagramProfileAuditListItem[] | InstagramProfileAudit> {
  if (options.id) {
    const rows = await supabaseRest<InstagramProfileAudit[]>(
      `${INSTAGRAM_PROFILE_AUDITS_TABLE}?id=eq.${encodeURIComponent(options.id)}&company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`
    );
    if (!rows.length) throw new InstagramProfileAuditNotFoundError(`Rapor bulunamadı veya bu müşteriye ait değil: ${options.id}`);
    return rows[0];
  }
  const limit = Math.max(1, Math.min(50, Number(options.limit) || 10));
  return supabaseRest<InstagramProfileAuditListItem[]>(
    `${INSTAGRAM_PROFILE_AUDITS_TABLE}?company_id=eq.${encodeURIComponent(companyId)}&select=id,audit_date,status,instagram_username,overall_summary,created_at&order=audit_date.desc,created_at.desc&limit=${limit}`
  );
}

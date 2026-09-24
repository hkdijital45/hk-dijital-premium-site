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
import { tokenForCustomerMetaIntegration, graphGet } from "@/lib/meta-business-phase2";

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

export type InstagramProfileMetadata = {
  available: boolean;
  source: "hk_connect_graph_api";
  id: string | null;
  username: string | null;
  name: string | null;
  biography: string | null;
  website: string | null;
  profilePictureUrl: string | null;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  error: string | null;
};

export type InstagramRecentMediaItem = {
  id: string;
  mediaType: string | null;
  timestamp: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
};

/** Resolves THIS company's own OAuth-connected Instagram Business asset —
 * queried strictly by this company's `customer_integrations` row (never a
 * shared/global row) — so it is structurally impossible for one company's
 * profile audit to read another company's (or HK Dijital's own agency
 * account's) Instagram data. Returns the real Graph API IG user id + a
 * usable access token only when a connected instagram_business asset
 * actually exists for this company. */
export async function resolveConnectedInstagramAsset(companyId: string): Promise<{ igUserId: string | null; username: string | null; token: string }> {
  const { token, integration } = await tokenForCustomerMetaIntegration(companyId);
  const assets: any[] = Array.isArray(integration?.integration_assets) ? integration.integration_assets : [];
  const igAsset = assets.find((item) => (item?.asset_type === "instagram_business" || item?.account_type === "instagram_business") && String(item?.status || item?.oauth_status || "").startsWith("connected"));
  const igUserId = igAsset?.account_id || igAsset?.asset_id || igAsset?.provider_account_id || null;
  const username = igAsset?.metadata?.username || null;
  return { igUserId: igUserId ? String(igUserId) : null, username, token };
}

/** Real, connected Instagram identity for this company — read from the
 * OAuth-connected instagram_business asset (see customer-integration-
 * oauth.ts's saveMetaPhase1Integration), never guessed. Falls back to the
 * company's own manually-entered `instagram` field (companies.instagram)
 * only when no OAuth-connected asset exists, so a username is still shown
 * even before the customer connects via HK Connect. */
export async function resolveInstagramIdentity(companyId: string): Promise<{ igUserId: string | null; username: string | null; token: string; source: "oauth" | "manual" | "none" }> {
  const asset = await resolveConnectedInstagramAsset(companyId);
  if (asset.igUserId) return { ...asset, source: "oauth" };

  const companies = await supabaseRest<Array<{ instagram: string | null }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=instagram&limit=1`);
  const manual = companies[0]?.instagram || null;
  return { igUserId: null, username: manual ? manual.replace(/^@/, "") : null, token: "", source: manual ? "manual" : "none" };
}

/** Real profile metadata only — nothing the Graph API doesn't actually
 * return is ever filled in. A missing field stays `null`; an API/permission
 * failure is reported separately via `error`/`available: false` so Claude
 * can tell "field genuinely empty" apart from "could not read this at
 * all" instead of treating both the same way. */
export async function fetchInstagramProfileMetadata(igUserId: string, token: string): Promise<InstagramProfileMetadata> {
  const empty = { id: null, username: null, name: null, biography: null, website: null, profilePictureUrl: null, followersCount: null, followsCount: null, mediaCount: null };
  try {
    const data = await graphGet(igUserId, token, { fields: "id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count" });
    return {
      available: true,
      source: "hk_connect_graph_api",
      id: data?.id ?? null,
      username: data?.username ?? null,
      name: data?.name ?? null,
      biography: data?.biography ?? null,
      website: data?.website ?? null,
      profilePictureUrl: data?.profile_picture_url ?? null,
      followersCount: typeof data?.followers_count === "number" ? data.followers_count : null,
      followsCount: typeof data?.follows_count === "number" ? data.follows_count : null,
      mediaCount: typeof data?.media_count === "number" ? data.media_count : null,
      error: null
    };
  } catch (error) {
    return { available: false, source: "hk_connect_graph_api", ...empty, error: error instanceof Error ? error.message : "Instagram profil verisi alınamadı." };
  }
}

/** Up to 12 most recent posts' basic metadata (id/type/timestamp/caption/
 * permalink/thumbnail), read through the same customer-scoped token/asset
 * — used only to verify real post identity for the profile showcase, never
 * insights/performance. Returns null (not a fabricated empty success) when
 * the read itself fails, so it's distinguishable from "zero posts". */
export async function fetchRecentInstagramMedia(igUserId: string, token: string): Promise<InstagramRecentMediaItem[] | null> {
  try {
    const data = await graphGet(`${igUserId}/media`, token, { fields: "id,media_type,timestamp,caption,permalink,thumbnail_url,media_url", limit: "12" });
    const items: any[] = Array.isArray(data?.data) ? data.data : [];
    return items.map((item) => ({
      id: String(item?.id ?? ""),
      mediaType: item?.media_type ?? null,
      timestamp: item?.timestamp ?? null,
      caption: item?.caption ?? null,
      permalink: item?.permalink ?? null,
      thumbnailUrl: item?.thumbnail_url ?? null,
      mediaUrl: item?.media_url ?? null
    }));
  } catch {
    return null;
  }
}

export type InstagramProfileAuditContext = {
  company: { id: string; name: string; sector: string | null; city: string | null; website: string | null };
  instagram: {
    username: string | null;
    usernameSource: "oauth" | "manual" | "none";
    connectionStatus: IntegrationStatus;
    profile: InstagramProfileMetadata | null;
    recentMedia: InstagramRecentMediaItem[] | null;
  };
  latestAudit: InstagramProfileAuditListItem | null;
};

/** Single, compact call for everything Claude needs to start a profile
 * audit — real company identity + this exact company's own OAuth-connected
 * Instagram profile metadata/recent media (never another company's, never
 * HK Dijital's own agency account) + the last saved audit (so Claude can
 * compare), never hundreds of raw rows and never fabricated Instagram data
 * this app has no real access to. */
export async function getInstagramProfileAuditContext(companyId: string): Promise<InstagramProfileAuditContext> {
  const [companies, integrations, identity] = await Promise.all([
    supabaseRest<Array<{ id: string; name: string; sector: string | null; city: string | null; website: string | null }>>(`companies?id=eq.${encodeURIComponent(companyId)}&select=id,name,sector,city,website&limit=1`),
    getCustomerIntegrations(companyId),
    resolveInstagramIdentity(companyId)
  ]);
  const company = companies[0];
  if (!company) throw new InstagramProfileAuditNotFoundError(`company_id doğrulanamadı: ${companyId}`);

  const [latest] = await supabaseRest<InstagramProfileAuditListItem[]>(
    `${INSTAGRAM_PROFILE_AUDITS_TABLE}?company_id=eq.${encodeURIComponent(companyId)}&select=id,audit_date,status,instagram_username,overall_summary,created_at&order=audit_date.desc,created_at.desc&limit=1`
  );

  let profile: InstagramProfileMetadata | null = null;
  let recentMedia: InstagramRecentMediaItem[] | null = null;
  let username = identity.username;

  if (identity.igUserId) {
    if (identity.token) {
      profile = await fetchInstagramProfileMetadata(identity.igUserId, identity.token);
      if (profile.available && profile.username) username = profile.username;
      recentMedia = await fetchRecentInstagramMedia(identity.igUserId, identity.token);
    } else {
      profile = {
        available: false, source: "hk_connect_graph_api",
        id: null, username: null, name: null, biography: null, website: null, profilePictureUrl: null,
        followersCount: null, followsCount: null, mediaCount: null,
        error: "Instagram bağlı ama Meta erişim token'ı okunamadı."
      };
    }
  }

  return {
    company,
    instagram: { username, usernameSource: identity.source, connectionStatus: integrations.instagram, profile, recentMedia },
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

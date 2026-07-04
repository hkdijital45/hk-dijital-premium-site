/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getSession, isCustomerRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const sensitiveFields = ["login_email", "login_username", "login_password", "recovery_email", "two_factor_note", "access_note", "sensitive_metadata"];
const platformLabels: Record<string, string> = {
  meta: "Meta Ads",
  instagram: "Instagram",
  tiktok: "TikTok",
  google_ads: "Google Ads",
  google_analytics: "Google Analytics",
  youtube: "YouTube",
  search_console: "Google Search Console",
  x_twitter: "X / Twitter",
  website_pixel: "Website / Pixel Bilgileri"
};

function maskSecret(value: unknown) {
  return value ? "••••••" : "";
}

function sanitize(row: any = {}) {
  const next = { ...row };
  for (const field of sensitiveFields) next[field] = field === "sensitive_metadata" ? {} : maskSecret(next[field]);
  return next;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeAsset(body: Record<string, any>) {
  const platform = clean(body.platform);
  const assetType = clean(body.asset_type || body.assetType || platform);
  if (!platform || !assetType) return null;
  const connectionMode = clean(body.connection_mode || body.connectionMode) || "manual";
  const connectionMethod = clean(body.connection_method || body.connectionMethod) || connectionMode;
  const oauthStatus = clean(body.oauth_status || body.oauthStatus) || (connectionMode === "oauth_ready" ? "not_configured" : "not_configured");
  const manualPayload = Object.fromEntries(Object.entries(body).filter(([key, value]) => !sensitiveFields.includes(key) && !["platform", "asset_type", "assetType", "asset_name", "assetName", "connection_mode", "connectionMode", "connection_method", "connectionMethod"].includes(key) && value !== undefined && value !== null && String(value).trim() !== ""));
  return {
    id: clean(body.id) || `${platform}-${Date.now()}`,
    platform,
    platform_label: platformLabels[platform] || platform,
    asset_type: assetType,
    asset_name: clean(body.asset_name || body.assetName || platformLabels[platform] || platform),
    asset_id: clean(body.asset_id || body.assetId),
    account_id: clean(body.account_id || body.accountId),
    website_url: clean(body.website_url || body.websiteUrl),
    profile_url: clean(body.profile_url || body.profileUrl),
    status: clean(body.status) || (connectionMode === "manual" ? "manual_pending_review" : "pending_review"),
    source: "customer",
    connection_mode: connectionMode,
    connection_method: connectionMethod,
    admin_review_status: "waiting",
    provider: clean(body.provider) || platform,
    oauth_status: oauthStatus,
    oauth_account_id: clean(body.oauth_account_id || body.oauthAccountId),
    oauth_asset_id: clean(body.oauth_asset_id || body.oauthAssetId || body.asset_id),
    oauth_asset_type: clean(body.oauth_asset_type || body.oauthAssetType || assetType),
    oauth_scopes: Array.isArray(body.oauth_scopes) ? body.oauth_scopes.filter(Boolean).map(clean) : [],
    token_expires_at: clean(body.token_expires_at || body.tokenExpiresAt),
    connection_error: clean(body.connection_error || body.connectionError),
    last_tested_at: clean(body.last_tested_at || body.lastTestedAt),
    last_sync_status: clean(body.last_sync_status || body.lastSyncStatus),
    last_sync_message: clean(body.last_sync_message || body.lastSyncMessage),
    auto_discovered: Boolean(body.auto_discovered || connectionMode === "oauth_ready"),
    oauth_assets: Array.isArray(body.oauth_assets) ? body.oauth_assets : [],
    provider_account_id: clean(body.provider_account_id || body.account_id || body.asset_id),
    provider_account_name: clean(body.provider_account_name || body.asset_name),
    account_type: clean(body.account_type || assetType),
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    manual_payload: body.manual_payload && typeof body.manual_payload === "object" ? body.manual_payload : manualPayload,
    notes: clean(body.notes),
    updated_at: new Date().toISOString()
  };
}

function topLevelPatch(asset: any, body: Record<string, any>) {
  const patch: Record<string, unknown> = {
    status: asset.status || "pending_review",
    source: "customer",
    connection_mode: asset.connection_mode || "manual",
    connection_method: asset.connection_method || asset.connection_mode || "manual",
    admin_review_status: "waiting",
    provider: asset.provider || asset.platform,
    provider_account_id: asset.provider_account_id || "",
    provider_account_name: asset.provider_account_name || "",
    account_type: asset.account_type || asset.asset_type,
    oauth_status: asset.oauth_status || "not_configured",
    oauth_account_id: asset.oauth_account_id || "",
    oauth_asset_id: asset.oauth_asset_id || "",
    oauth_asset_type: asset.oauth_asset_type || asset.asset_type,
    oauth_scopes: asset.oauth_scopes || [],
    token_expires_at: asset.token_expires_at || null,
    connection_error: asset.connection_error || "",
    last_tested_at: asset.last_tested_at || null,
    last_sync_status: asset.last_sync_status || "",
    last_sync_message: asset.last_sync_message || "",
    auto_discovered: Boolean(asset.auto_discovered),
    metadata: asset.metadata || {},
    manual_payload: asset.manual_payload || {},
    updated_at: new Date().toISOString()
  };
  if (asset.platform === "meta") {
    patch.meta_business_id = clean(body.meta_business_id);
    patch.meta_ad_account_id = clean(body.meta_ad_account_id || asset.account_id);
    patch.meta_page_id = clean(body.meta_page_id);
    patch.meta_pixel_id = clean(body.meta_pixel_id || body.pixel_id);
  }
  if (asset.platform === "instagram") patch.instagram_business_id = clean(body.instagram_business_id || body.username || asset.asset_id);
  if (asset.platform === "tiktok") {
    patch.provider_account_id = clean(body.account_id || body.asset_id || asset.provider_account_id);
    patch.provider_account_name = clean(body.asset_name || body.username || asset.provider_account_name);
  }
  if (asset.platform === "google_ads") patch.google_ads_customer_id = clean(body.google_ads_customer_id || asset.account_id);
  if (asset.platform === "google_analytics") {
    patch.ga4_measurement_id = clean(body.ga4_measurement_id);
    patch.ga4_property_id = clean(body.ga4_property_id || asset.asset_id);
  }
  if (asset.platform === "search_console") patch.search_console_site_url = clean(body.search_console_site_url || body.website_url);
  if (asset.platform === "website_pixel") {
    patch.website_url = clean(body.website_url || asset.website_url);
    patch.meta_pixel_id = clean(body.meta_pixel_id || body.pixel_id);
    patch.gtm_container_id = clean(body.gtm_container_id);
    patch.search_console_site_url = clean(body.search_console_site_url);
  }
  return patch;
}

async function getRow(companyId: string) {
  const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`).catch(() => []);
  return rows[0] || null;
}

export async function GET() {
  const session = await getSession();
  if (!session || !isCustomerRole(session.role) || !session.companyId) return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ integration: null, assets: [], warning: "Supabase bağlantısı yapılandırılmadı." });
  try {
    const row = await getRow(session.companyId);
    return NextResponse.json({ integration: sanitize(row || {}), assets: Array.isArray(row?.integration_assets) ? row.integration_assets : [] });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isCustomerRole(session.role) || !session.companyId) return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const asset = normalizeAsset(body);
  if (!asset) return NextResponse.json({ error: "Platform ve varlık türü zorunludur." }, { status: 400 });
  try {
    const existing = await getRow(session.companyId);
    const assets = Array.isArray(existing?.integration_assets) ? existing.integration_assets : [];
    const nextAssets = [asset, ...assets.filter((item: any) => item.platform !== asset.platform)];
    const patch = {
      company_id: session.companyId,
      ...topLevelPatch(asset, body),
      integration_assets: nextAssets,
      updated_by: session.profileId || null,
      created_by: existing?.created_by || session.profileId || null
    };
    const rows = await supabaseRest<any[]>("customer_integrations?on_conflict=company_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(patch)
    });
    return NextResponse.json({ ok: true, integration: sanitize(rows[0]), assets: nextAssets, message: "Hesap bilgileri kaydedildi. HK Dijital ekibi kontrol edecek." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

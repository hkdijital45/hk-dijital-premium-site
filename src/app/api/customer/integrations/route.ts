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
    status: "pending_review",
    source: "customer",
    connection_mode: "manual",
    admin_review_status: "waiting",
    notes: clean(body.notes),
    updated_at: new Date().toISOString()
  };
}

function topLevelPatch(asset: any, body: Record<string, any>) {
  const patch: Record<string, unknown> = {
    status: "pending_review",
    source: "customer",
    connection_mode: "manual",
    admin_review_status: "waiting",
    updated_at: new Date().toISOString()
  };
  if (asset.platform === "meta") {
    patch.meta_business_id = clean(body.meta_business_id);
    patch.meta_ad_account_id = clean(body.meta_ad_account_id || asset.account_id);
    patch.meta_page_id = clean(body.meta_page_id);
    patch.meta_pixel_id = clean(body.meta_pixel_id || body.pixel_id);
  }
  if (asset.platform === "instagram") patch.instagram_business_id = clean(body.instagram_business_id || body.username || asset.asset_id);
  if (asset.platform === "google_ads") patch.google_ads_customer_id = clean(body.google_ads_customer_id || asset.account_id);
  if (asset.platform === "google_analytics") {
    patch.ga4_measurement_id = clean(body.ga4_measurement_id);
    patch.ga4_property_id = clean(body.ga4_property_id || asset.asset_id);
  }
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
      login_email: clean(body.login_email),
      login_username: clean(body.login_username),
      login_password: clean(body.login_password),
      recovery_email: clean(body.recovery_email),
      two_factor_note: clean(body.two_factor_note),
      access_note: clean(body.access_note),
      sensitive_metadata: body.sensitive_metadata && typeof body.sensitive_metadata === "object" ? body.sensitive_metadata : {},
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

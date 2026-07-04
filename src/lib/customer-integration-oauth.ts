import { NextResponse } from "next/server";
import { getSession, isCustomerRole } from "@/lib/auth";

type Provider = "meta" | "google" | "tiktok";

// Gerçek access_token / refresh_token düz metin saklama yapılmaz.
// OAuth üretime alınırken şifreleme helper'ı eklenmeden yalnız durum ve asset metadata tutulur.
const providerConfig: Record<Provider, {
  label: string;
  env: string[];
  authBase: string;
  scope: string;
  assetTypes: string[];
}> = {
  meta: {
    label: "Meta",
    env: ["META_CLIENT_ID", "META_CLIENT_SECRET", "META_REDIRECT_URI"],
    authBase: "https://www.facebook.com/v20.0/dialog/oauth",
    scope: "business_management,ads_read,pages_show_list,instagram_basic",
    assetTypes: ["Business Manager", "Ad Account", "Page", "Instagram Business Account", "Pixel"]
  },
  google: {
    label: "Google",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    authBase: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly",
    assetTypes: ["Google Ads Customer", "GA4 Property", "Search Console Site"]
  },
  tiktok: {
    label: "TikTok",
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"],
    authBase: "https://business-api.tiktok.com/portal/auth",
    scope: "business,ad_account,report",
    assetTypes: ["Business Center", "Ads Account", "Pixel"]
  }
};

function missingEnv(provider: Provider) {
  return providerConfig[provider].env.filter((key) => !process.env[key]);
}

async function requireCustomerSession() {
  const session = await getSession();
  return session && isCustomerRole(session.role) && session.companyId ? session : null;
}

function configuredPayload(provider: Provider, request: Request) {
  const config = providerConfig[provider];
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") || provider;
  const redirectUri = process.env[provider === "meta" ? "META_REDIRECT_URI" : provider === "google" ? "GOOGLE_REDIRECT_URI" : "TIKTOK_REDIRECT_URI"] || "";
  const clientId = process.env[provider === "meta" ? "META_CLIENT_ID" : provider === "google" ? "GOOGLE_CLIENT_ID" : "TIKTOK_CLIENT_KEY"] || "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state: Buffer.from(JSON.stringify({ provider, platform, ts: Date.now() })).toString("base64url")
  });
  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }
  params.set("scope", config.scope);
  return {
    ok: true,
    configured: true,
    provider,
    providerLabel: config.label,
    oauthStatus: "oauth_ready",
    authUrl: `${config.authBase}?${params.toString()}`,
    message: `${config.label} otomatik bağlantı URL'i hazırlandı. Callback tamamlandığında yetkili hesap seçimi açılacak.`
  };
}

function notConfigured(provider: Provider) {
  const config = providerConfig[provider];
  const missing = missingEnv(provider);
  return NextResponse.json({
    ok: false,
    code: "oauth_not_configured",
    configured: false,
    provider,
    providerLabel: config.label,
    oauthStatus: "not_configured",
    missingEnv: missing,
    message: `${config.label} otomatik bağlantısı henüz aktif değil. Manuel bilgi girebilirsiniz.`
  }, { status: 501 });
}

export async function oauthStart(provider: Provider, request: Request) {
  const session = await requireCustomerSession();
  if (!session) return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });
  if (missingEnv(provider).length) return notConfigured(provider);
  return NextResponse.json(configuredPayload(provider, request));
}

export async function oauthCallback(provider: Provider, request: Request) {
  const session = await requireCustomerSession();
  if (!session) return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });
  if (missingEnv(provider).length) return notConfigured(provider);
  const url = new URL(request.url);
  const hasCode = Boolean(url.searchParams.get("code"));
  return NextResponse.json({
    ok: hasCode,
    provider,
    oauthStatus: hasCode ? "pending" : "error",
    message: hasCode
      ? "OAuth callback alındı. Token güvenli saklama katmanı etkinleştiğinde yetkili hesaplar çekilecek."
      : "OAuth callback kodu bulunamadı."
  }, { status: hasCode ? 200 : 400 });
}

export async function oauthAssets(provider: Provider, request: Request) {
  const session = await requireCustomerSession();
  if (!session) return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });
  const config = providerConfig[provider];
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") || provider;
  const missing = missingEnv(provider);
  const assets = config.assetTypes.map((assetType, index) => ({
    id: `${provider}-${assetType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    platform,
    provider,
    asset_type: assetType,
    asset_name: `${config.label} ${assetType}`,
    account_id: missing.length ? "" : `${provider.toUpperCase()}-${index + 1}`,
    asset_id: missing.length ? "" : `${provider.toUpperCase()}-ASSET-${index + 1}`,
    status: missing.length ? "OAuth hazırlık" : "Seçilebilir",
    last_synced_at: null,
    connection_mode: "oauth_ready"
  }));
  return NextResponse.json({
    ok: !missing.length,
    configured: !missing.length,
    code: missing.length ? "oauth_not_configured" : "oauth_ready",
    provider,
    providerLabel: config.label,
    oauthStatus: missing.length ? "not_configured" : "oauth_ready",
    missingEnv: missing,
    assets,
    message: missing.length
      ? `${config.label} env değerleri eksik olduğu için gerçek hesap listesi alınamadı. Bu liste yalnız hazırlık amaçlıdır.`
      : `${config.label} yetkili hesap seçim listesi hazır.`
  }, { status: missing.length ? 501 : 200 });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getSession, isCustomerRole, isStaffRole } from "@/lib/auth";
import { encryptSecret } from "@/lib/business-flow";
import { diagnoseMetaBusinessAccess, listMetaBusinessAssets, META_BUSINESS_REQUIRED_SCOPES, publicMetaDiagnostics, tokenForCustomerMetaIntegration } from "@/lib/meta-business-phase2";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export type Provider = "meta" | "google" | "tiktok" | "x";
type OAuthState = {
  provider: Provider;
  platform: string;
  customerId: string;
  returnTo: string;
  nonce: string;
  exp: number;
};

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
    scope: "public_profile,email",
    assetTypes: ["Business Manager", "Ad Account", "Page", "Instagram Business Account", "Pixel"]
  },
  google: {
    label: "Google",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    authBase: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email profile https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/business.manage",
    assetTypes: ["Google Ads Customer", "GA4 Property", "Search Console Site", "Google Business Profile"]
  },
  tiktok: {
    label: "TikTok",
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"],
    authBase: "https://business-api.tiktok.com/portal/auth",
    scope: "business,ad_account,report",
    assetTypes: ["Business Center", "Ads Account", "Pixel"]
  },
  x: {
    label: "X / Twitter",
    env: ["X_CLIENT_ID", "X_CLIENT_SECRET", "X_REDIRECT_URI"],
    authBase: "https://twitter.com/i/oauth2/authorize",
    scope: "tweet.read users.read offline.access",
    assetTypes: ["X Profile", "X Ads Account"]
  }
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function baseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") || new URL(request.url).searchParams.get("format") === "json";
}

function safeReturnTo(value: string, fallback = "/musteri-paneli#hesap-bagla") {
  const raw = clean(value) || fallback;
  try {
    const parsed = new URL(raw, "https://hkdijital.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash || "#hesap-bagla"}`;
  } catch {
    return fallback;
  }
}

function redirectWithIntegrationError(request: Request, returnTo: string, provider: Provider, code: string, params: Record<string, string> = {}) {
  const target = new URL(safeReturnTo(returnTo), baseUrl(request));
  target.searchParams.set("integration_provider", provider);
  target.searchParams.set("integration_error", code);
  Object.entries(params).forEach(([key, value]) => {
    if (value) target.searchParams.set(key, value);
  });
  if (!target.hash) target.hash = "hesap-bagla";
  return NextResponse.redirect(target);
}

function firstEnv(keys: string[]) {
  return keys.map((key) => process.env[key]).find(Boolean) || "";
}

function providerCredentials(provider: Provider) {
  if (provider === "meta") {
    return {
      clientId: firstEnv(["META_APP_ID", "META_CLIENT_ID"]),
      clientSecret: firstEnv(["META_APP_SECRET", "META_CLIENT_SECRET"]),
      redirectUri: process.env.META_REDIRECT_URI || ""
    };
  }
  if (provider === "google") {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirectUri: process.env.GOOGLE_REDIRECT_URI || ""
    };
  }
  if (provider === "tiktok") {
    return {
      clientId: process.env.TIKTOK_CLIENT_KEY || "",
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || "",
      redirectUri: process.env.TIKTOK_REDIRECT_URI || ""
    };
  }
  return {
    clientId: firstEnv(["X_CLIENT_ID", "TWITTER_CLIENT_ID"]),
    clientSecret: firstEnv(["X_CLIENT_SECRET", "TWITTER_CLIENT_SECRET"]),
    redirectUri: firstEnv(["X_REDIRECT_URI", "TWITTER_REDIRECT_URI"])
  };
}

function maskClientId(value = "") {
  if (!value) return "";
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function pkceChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

function advancedScopesEnabled(provider: Provider) {
  return provider === "meta" && process.env.META_ADVANCED_SCOPES_ENABLED === "true";
}

function effectiveProviderScope(provider: Provider) {
  return providerConfig[provider].scope;
}

function providerScopeList(provider: Provider) {
  return effectiveProviderScope(provider).split(/[,\s]+/).map((scope) => scope.trim()).filter(Boolean);
}

function providerEnvPairs(provider: Provider) {
  const credentials = providerCredentials(provider);
  if (provider === "meta") return [["META_APP_ID veya META_CLIENT_ID", credentials.clientId], ["META_APP_SECRET veya META_CLIENT_SECRET", credentials.clientSecret], ["META_REDIRECT_URI", credentials.redirectUri]];
  if (provider === "google") return [["GOOGLE_CLIENT_ID", credentials.clientId], ["GOOGLE_CLIENT_SECRET", credentials.clientSecret], ["GOOGLE_REDIRECT_URI", credentials.redirectUri]];
  if (provider === "tiktok") return [["TIKTOK_CLIENT_KEY", credentials.clientId], ["TIKTOK_CLIENT_SECRET", credentials.clientSecret], ["TIKTOK_REDIRECT_URI", credentials.redirectUri]];
  return [["X_CLIENT_ID veya TWITTER_CLIENT_ID", credentials.clientId], ["X_CLIENT_SECRET veya TWITTER_CLIENT_SECRET", credentials.clientSecret], ["X_REDIRECT_URI veya TWITTER_REDIRECT_URI", credentials.redirectUri]];
}

function missingProviderEnv(provider: Provider) {
  return providerEnvPairs(provider).filter(([, value]) => !value).map(([name]) => name);
}

export const oauthProviders = ["meta", "google", "tiktok", "x"] as const;

const expectedRedirectUris: Record<Provider, string> = {
  meta: "https://hkdijital.com.tr/api/integrations/callback/meta",
  google: "https://hkdijital.com.tr/api/integrations/callback/google",
  tiktok: "https://hkdijital.com.tr/api/integrations/callback/tiktok",
  x: "https://hkdijital.com.tr/api/integrations/callback/x"
};

function buildAuthorizePreview(provider: Provider, redirectUri: string) {
  const config = providerConfig[provider];
  const scope = effectiveProviderScope(provider);
  const params = new URLSearchParams(provider === "tiktok" ? {
    app_id: "<configured>",
    redirect_uri: redirectUri || expectedRedirectUris[provider],
    state: "<signed-state>",
    scope
  } : {
    client_id: "<configured>",
    redirect_uri: redirectUri || expectedRedirectUris[provider],
    response_type: "code",
    scope,
    state: "<signed-state>"
  });
  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }
  if (provider === "x") {
    params.set("code_challenge", "<pkce>");
    params.set("code_challenge_method", "S256");
  }
  return `${config.authBase}?${params.toString()}`;
}

export function getOAuthProviderStatus(provider: Provider) {
  const credentials = providerCredentials(provider);
  const missing = missingProviderEnv(provider);
  const expectedRedirectUri = expectedRedirectUris[provider];
  const redirectUriMatches = Boolean(credentials.redirectUri) && credentials.redirectUri === expectedRedirectUri;
  return {
    provider,
    label: providerConfig[provider].label,
    activeClientId: credentials.clientId,
    activeClientIdMasked: maskClientId(credentials.clientId),
    ready: missing.length === 0 && redirectUriMatches,
    basicLoginReady: provider === "meta" ? missing.length === 0 && redirectUriMatches && providerScopeList(provider).includes("public_profile") : undefined,
    configured: missing.length === 0,
    missing,
    scope: effectiveProviderScope(provider),
    scopes: providerScopeList(provider),
    loginScopes: providerScopeList(provider),
    advancedScopesEnabled: advancedScopesEnabled(provider),
    advancedRequiredScopes: provider === "meta" ? META_BUSINESS_REQUIRED_SCOPES : undefined,
    businessAssetListingReady: provider === "meta" ? advancedScopesEnabled(provider) : undefined,
    businessAssetListingMessage: provider === "meta"
      ? advancedScopesEnabled(provider)
        ? "Business API teşhis/deneme modu aktif. Gelişmiş izinler OAuth URL'sine eklenmez; API erişimi App Review / Business Verification sonucuna göre test edilir."
        : "Business API teşhisi kapalı. OAuth login yalnız public_profile,email ile çalışır; reklam hesabı manuel ID ile bağlanabilir."
      : undefined,
    businessPermissionNote: provider === "meta" ? "business_management, ads_read, pages_show_list ve instagram_basic OAuth URL'ye eklenmez; yalnız Business API teşhis sonucu ve App Review gereksinimi olarak gösterilir." : undefined,
    manualAdAccountSupported: provider === "meta" ? true : undefined,
    manualFallbackMessage: provider === "meta" ? "Business Verification yokken önerilen mod: Meta reklam hesabı ID'sini manuel bağlayın. ads_read onayı geldiğinde aynı kayıt üzerinden insight çekimi denenir." : undefined,
    googleApiNotes: provider === "google" ? [
      "GA4 için Google Analytics Admin/Data API etkin olmalı.",
      "Search Console için Webmasters API etkin olmalı.",
      "Google Ads için GOOGLE_ADS_DEVELOPER_TOKEN ve erişilebilir müşteri hesabı gerekir.",
      "Google Business Profile için Business Profile API erişimi gerekir."
    ] : undefined,
    redirectUri: credentials.redirectUri,
    expectedRedirectUri,
    redirectUriMatches,
    authorizeUrlPreview: buildAuthorizePreview(provider, credentials.redirectUri || expectedRedirectUri)
  };
}

function stateSecret() {
  return firstEnv(["OAUTH_STATE_SECRET", "NEXTAUTH_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "META_APP_SECRET", "META_CLIENT_SECRET"]) || "hk-dijital-local-oauth-state";
}

function sign(value: string) {
  return crypto.createHmac("sha256", stateSecret()).update(value).digest("base64url");
}

function encodeState(state: OAuthState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeState(raw: string): OAuthState | null {
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
    if (!state.exp || state.exp < Date.now()) return null;
    return state;
  } catch {
    return null;
  }
}

function encryptSession(payload: Record<string, unknown>) {
  const key = crypto.createHash("sha256").update(stateSecret()).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSession(raw = "") {
  try {
    const [ivRaw, tagRaw, encryptedRaw] = raw.split(".");
    if (!ivRaw || !tagRaw || !encryptedRaw) return null;
    const key = crypto.createHash("sha256").update(stateSecret()).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8"));
  } catch {
    return null;
  }
}

async function requireCustomerSession() {
  const session = await getSession();
  return session && isCustomerRole(session.role) && session.companyId ? session : null;
}

async function requireIntegrationSession() {
  const session = await getSession();
  if (!session) return null;
  if (isCustomerRole(session.role) && session.companyId) return session;
  if (isStaffRole(session.role)) return session;
  return null;
}

function configuredPayload(provider: Provider, request: Request) {
  const config = providerConfig[provider];
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") || provider;
  const { redirectUri, clientId } = providerCredentials(provider);
  const scope = effectiveProviderScope(provider);
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
  params.set("scope", scope);
  return {
    ok: true,
    configured: true,
    provider,
    providerLabel: config.label,
    oauthStatus: "oauth_ready",
    scope,
    scopes: providerScopeList(provider),
    advancedScopesEnabled: advancedScopesEnabled(provider),
    authUrl: `${config.authBase}?${params.toString()}`,
    message: `${config.label} otomatik bağlantı URL'i hazırlandı. Callback tamamlandığında yetkili hesap seçimi açılacak.`
  };
}

function notConfigured(provider: Provider) {
  const config = providerConfig[provider];
  const missing = missingProviderEnv(provider);
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
  if (missingProviderEnv(provider).length) return notConfigured(provider);
  return NextResponse.json(configuredPayload(provider, request));
}

export async function oauthConnect(provider: Provider, request: Request) {
  const session = await requireCustomerSession();
  const url = new URL(request.url);
  const returnTo = safeReturnTo(clean(url.searchParams.get("returnTo")) || clean(url.searchParams.get("returnUrl")) || "/musteri-paneli#hesap-bagla");
  if (!session) {
    if (wantsJson(request)) {
      return NextResponse.json({ ok: false, error: "SESSION_MISSING", message: "Oturum doğrulanamadı. Lütfen panelden çıkış yapıp tekrar giriş yapın." }, { status: 401 });
    }
    return redirectWithIntegrationError(request, returnTo, provider, "session_missing");
  }
  const requestedCompany = clean(url.searchParams.get("company") || url.searchParams.get("customerId"));
  if (requestedCompany && requestedCompany !== session.companyId) {
    if (wantsJson(request)) return NextResponse.json({ ok: false, error: "COMPANY_MISMATCH", message: "Bu bağlantı isteği mevcut müşteri oturumuyla eşleşmiyor." }, { status: 403 });
    return redirectWithIntegrationError(request, returnTo, provider, "company_mismatch");
  }
  const missing = missingProviderEnv(provider);
  if (missing.length) {
    const errorCode = `${provider}_env_missing`;
    if (wantsJson(request)) {
      return NextResponse.json({ ok: false, error: errorCode.toUpperCase(), provider, missingEnv: missing, message: `${providerConfig[provider].label} bağlantısı için uygulama ayarları eksik.` }, { status: 501 });
    }
    return redirectWithIntegrationError(request, returnTo, provider, errorCode, { missing_env: missing.join(",") });
  }
  const config = providerConfig[provider];
  const credentials = providerCredentials(provider);
  const scope = effectiveProviderScope(provider);
  const platform = clean(url.searchParams.get("platform")) || provider;
  const nonce = crypto.randomBytes(18).toString("base64url");
  const state = encodeState({ provider, platform, customerId: session.companyId || "", returnTo, nonce, exp: Date.now() + 10 * 60 * 1000 });
  const codeVerifier = provider === "x" ? crypto.randomBytes(48).toString("base64url") : "";
  const params = new URLSearchParams(provider === "tiktok" ? {
    app_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    state
  } : provider === "x" ? {
    client_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: "code",
    state,
    scope,
    code_challenge: pkceChallenge(codeVerifier),
    code_challenge_method: "S256"
  } : {
    client_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: "code",
    state,
    scope
  });
  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }
  if (provider === "tiktok") params.set("scope", scope);
  const response = NextResponse.redirect(`${config.authBase}?${params.toString()}`);
  response.cookies.set(`hk_oauth_state_${provider}`, nonce, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  if (codeVerifier) response.cookies.set(`hk_oauth_pkce_${provider}`, codeVerifier, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  return response;
}

async function exchangeCode(provider: Provider, code: string, codeVerifier = "") {
  const credentials = providerCredentials(provider);
  if (provider === "meta") {
    const params = new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, redirect_uri: credentials.redirectUri, code });
    const response = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${params.toString()}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || "Meta token alınamadı.");
    return { accessToken: payload.access_token, expiresIn: payload.expires_in, scope: effectiveProviderScope("meta") };
  }
  if (provider === "google") {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, redirect_uri: credentials.redirectUri, code, grant_type: "authorization_code" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error_description || payload.error || "Google token alınamadı.");
    return { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresIn: payload.expires_in, scope: payload.scope };
  }
  if (provider === "tiktok") {
    const response = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: credentials.clientId, secret: credentials.clientSecret, auth_code: code })
    });
    const payload = await response.json().catch(() => ({}));
    const accessToken = payload.data?.access_token || payload.access_token;
    if (!response.ok || !accessToken) throw new Error(payload.message || "TikTok token alınamadı.");
    return { accessToken, refreshToken: payload.data?.refresh_token, expiresIn: payload.data?.expires_in, scope: effectiveProviderScope("tiktok") };
  }
  const response = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString("base64")}`
    },
    body: new URLSearchParams({ client_id: credentials.clientId, redirect_uri: credentials.redirectUri, code, grant_type: "authorization_code", code_verifier: codeVerifier })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || "X/Twitter token alınamadı.");
  return { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresIn: payload.expires_in, scope: payload.scope || effectiveProviderScope("x") };
}

async function fetchMetaUserInfo(accessToken: string) {
  const response = await fetch(`https://graph.facebook.com/v20.0/me?${new URLSearchParams({ fields: "id,name,email", access_token: accessToken }).toString()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.id) throw new Error(payload.error?.message || "Meta kullanıcı bilgisi alınamadı.");
  return {
    id: clean(payload.id),
    name: clean(payload.name),
    email: clean(payload.email)
  };
}

async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.sub) throw new Error(payload.error_description || payload.error || "Google kullanıcı bilgisi alınamadı.");
  return {
    id: clean(payload.sub),
    name: clean(payload.name),
    email: clean(payload.email),
    picture: clean(payload.picture)
  };
}

async function saveMetaPhase1Integration(session: any, token: any, metaUser: { id: string; name: string; email: string }, expiresAt: string) {
  if (!hasSupabaseConfig()) throw new Error("Supabase bağlantısı yapılandırılmadı.");
  const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(session.companyId)}&select=*&limit=1`).catch(() => []);
  const existing = rows[0] || null;
  const currentAssets = Array.isArray(existing?.integration_assets) ? existing.integration_assets : [];
  const now = new Date().toISOString();
  const scopes = providerScopeList("meta");
  const phase1Asset = {
    id: `meta-user-${metaUser.id}`,
    provider: "meta",
    platform: "meta",
    platform_label: "Meta / Facebook",
    asset_type: "meta_user",
    asset_name: metaUser.name || metaUser.email || metaUser.id,
    asset_id: metaUser.id,
    account_id: metaUser.id,
    provider_account_id: metaUser.id,
    provider_account_name: metaUser.name || metaUser.email || metaUser.id,
    account_type: "meta_user",
    status: "connected_oauth",
    source: "customer",
    connection_mode: "oauth",
    connection_method: "oauth",
    admin_review_status: "approved",
    oauth_status: "connected",
    oauth_scopes: scopes,
    scopes,
    token_expires_at: expiresAt || null,
    last_synced_at: now,
    metadata: {
      phase: "meta_oauth_phase_1",
      meta_user_id: metaUser.id,
      meta_user_name: metaUser.name,
      meta_user_email: metaUser.email,
      advanced_permissions_enabled: advancedScopesEnabled("meta"),
      advanced_permissions_note: "Reklam hesabı listeleme için business_management, ads_read, pages_show_list ve instagram_basic gibi gelişmiş izinler ayrıca açılmalıdır."
    }
  };
  const nextAssets = [
    phase1Asset,
    ...currentAssets.filter((item: any) => `${item.provider || item.platform}-${item.account_type || item.asset_type}-${item.provider_account_id || item.account_id || item.asset_id}` !== `meta-meta_user-${metaUser.id}`)
  ];
  const patch = {
    company_id: session.companyId,
    customer_id: session.companyId,
    provider: "meta",
    platform: "meta",
    account_type: "meta_user",
    provider_account_id: metaUser.id,
    provider_account_name: metaUser.name || metaUser.email || metaUser.id,
    status: "connected_oauth",
    source: "customer",
    connection_mode: "oauth",
    connection_method: "oauth",
    admin_review_status: "approved",
    oauth_status: "connected",
    oauth_account_id: metaUser.id,
    oauth_asset_id: metaUser.id,
    oauth_asset_type: "meta_user",
    scopes,
    access_token_encrypted: encryptSecret(token.accessToken || ""),
    token_expires_at: expiresAt || null,
    metadata: phase1Asset.metadata,
    integration_assets: nextAssets,
    last_synced_at: now,
    sync_error: "",
    updated_by: session.profileId || null,
    created_by: existing?.created_by || session.profileId || null
  };
  await supabaseRest<any[]>("customer_integrations?on_conflict=company_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(patch) });
  return phase1Asset;
}

async function saveGoogleOAuthIntegration(session: any, token: any, googleUser: { id: string; name: string; email: string; picture?: string }, expiresAt: string) {
  if (!hasSupabaseConfig()) throw new Error("Supabase bağlantısı yapılandırılmadı.");
  const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(session.companyId)}&select=*&limit=1`).catch(() => []);
  const existing = rows[0] || null;
  const currentAssets = Array.isArray(existing?.integration_assets) ? existing.integration_assets : [];
  const now = new Date().toISOString();
  const scopes = String(token.scope || effectiveProviderScope("google")).split(/[,\s]+/).map(clean).filter(Boolean);
  const googleAsset = {
    id: `google-profile-${googleUser.id}`,
    provider: "google",
    platform: "google",
    platform_label: "Google",
    asset_type: "google_profile",
    asset_name: googleUser.email || googleUser.name || googleUser.id,
    asset_id: googleUser.id,
    account_id: googleUser.id,
    provider_account_id: googleUser.id,
    provider_account_name: googleUser.email || googleUser.name || googleUser.id,
    account_type: "google_profile",
    status: "connected_oauth",
    source: "customer",
    connection_mode: "oauth",
    connection_method: "oauth",
    admin_review_status: "approved",
    oauth_status: "connected",
    oauth_scopes: scopes,
    scopes,
    token_expires_at: expiresAt || null,
    last_synced_at: now,
    metadata: {
      phase: "google_oauth_phase_2",
      google_user_id: googleUser.id,
      google_user_name: googleUser.name,
      google_user_email: googleUser.email,
      picture: googleUser.picture || "",
      api_note: "GA4, Search Console, Google Ads ve Google Business Profile varlıkları server-side listelenir; token frontend'e dönmez."
    }
  };
  const nextAssets = [
    googleAsset,
    ...currentAssets.filter((item: any) => `${item.provider || item.platform}-${item.account_type || item.asset_type}-${item.provider_account_id || item.account_id || item.asset_id}` !== `google-google_profile-${googleUser.id}`)
  ];
  const sensitiveMetadata = {
    ...(existing?.sensitive_metadata && typeof existing.sensitive_metadata === "object" ? existing.sensitive_metadata : {}),
    google_oauth: {
      access_token_encrypted: encryptSecret(token.accessToken || ""),
      refresh_token_encrypted: token.refreshToken ? encryptSecret(token.refreshToken) : existing?.sensitive_metadata?.google_oauth?.refresh_token_encrypted || "",
      token_expires_at: expiresAt || null,
      scopes,
      updated_at: now
    }
  };
  const patch = {
    company_id: session.companyId,
    customer_id: session.companyId,
    provider: existing?.provider || "google",
    platform: existing?.platform || "google",
    account_type: existing?.account_type || "google_profile",
    provider_account_id: existing?.provider_account_id || googleUser.id,
    provider_account_name: existing?.provider_account_name || googleUser.email || googleUser.name || googleUser.id,
    status: existing?.status || "connected_oauth",
    source: "customer",
    connection_mode: existing?.connection_mode || "oauth",
    connection_method: existing?.connection_method || "oauth",
    admin_review_status: existing?.admin_review_status || "approved",
    oauth_status: "connected",
    oauth_account_id: existing?.oauth_account_id || googleUser.id,
    oauth_asset_id: existing?.oauth_asset_id || googleUser.id,
    oauth_asset_type: existing?.oauth_asset_type || "google_profile",
    scopes: Array.from(new Set([...(Array.isArray(existing?.scopes) ? existing.scopes : []), ...scopes])),
    sensitive_metadata: sensitiveMetadata,
    metadata: { ...(existing?.metadata || {}), google_user_email: googleUser.email, google_oauth_connected_at: now },
    integration_assets: nextAssets,
    last_synced_at: now,
    sync_error: "",
    updated_by: session.profileId || null,
    created_by: existing?.created_by || session.profileId || null
  };
  await supabaseRest<any[]>("customer_integrations?on_conflict=company_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(patch) });
  return googleAsset;
}

function callbackErrorCode(providerError: string, description: string) {
  const text = `${providerError} ${description}`.toLocaleLowerCase("tr-TR");
  if (text.includes("invalid scope") || text.includes("invalid_scopes")) return "invalid_scope";
  if (text.includes("redirect_uri")) return "redirect_uri_mismatch";
  if (text.includes("access_denied") || text.includes("denied")) return "permission_denied";
  return "permission_denied";
}

export async function oauthCallback(provider: Provider, request: Request) {
  const session = await requireCustomerSession();
  const url = new URL(request.url);
  const code = clean(url.searchParams.get("code"));
  const providerError = clean(url.searchParams.get("error"));
  const providerErrorDescription = clean(url.searchParams.get("error_description") || url.searchParams.get("error_message"));
  const rawState = clean(url.searchParams.get("state"));
  const state = decodeState(rawState);
  const returnTo = safeReturnTo(state?.returnTo || "/musteri-paneli#hesap-bagla");
  if (!session) return redirectWithIntegrationError(request, returnTo, provider, "session_missing");
  if (missingProviderEnv(provider).length) return redirectWithIntegrationError(request, returnTo, provider, `${provider}_env_missing`);
  const cookieStore = await cookies();
  const expectedNonce = cookieStore.get(`hk_oauth_state_${provider}`)?.value;
  const codeVerifier = cookieStore.get(`hk_oauth_pkce_${provider}`)?.value || "";
  const target = new URL(returnTo, baseUrl(request));
  if (providerError) {
    return redirectWithIntegrationError(request, returnTo, provider, callbackErrorCode(providerError, providerErrorDescription));
  }
  if (!code || !state || state.provider !== provider || state.customerId !== session.companyId || state.nonce !== expectedNonce) {
    return redirectWithIntegrationError(request, returnTo, provider, "state_invalid");
  }
  try {
    const token = await exchangeCode(provider, code, codeVerifier);
    const expiresAt = token.expiresIn ? new Date(Date.now() + Number(token.expiresIn) * 1000).toISOString() : "";
    let metaUser = null;
    if (provider === "meta") {
      try {
        metaUser = await fetchMetaUserInfo(token.accessToken);
        await saveMetaPhase1Integration(session, token, metaUser, expiresAt);
      } catch (error) {
        console.error("Meta OAuth Phase 1 user info/save failed", error instanceof Error ? error.message : "unknown_error");
        return redirectWithIntegrationError(request, returnTo, provider, "user_info_fetch_failed");
      }
    }
    if (provider === "google") {
      try {
        const googleUser = await fetchGoogleUserInfo(token.accessToken);
        await saveGoogleOAuthIntegration(session, token, googleUser, expiresAt);
      } catch (error) {
        console.error("Google OAuth user info/save failed", error instanceof Error ? error.message : "unknown_error");
        return redirectWithIntegrationError(request, returnTo, provider, "user_info_fetch_failed");
      }
    }
    target.searchParams.set("integration_provider", provider);
    target.searchParams.set("integration_success", provider);
    target.searchParams.set("oauth_status", "accounts_ready");
    if (!target.hash) target.hash = "hesap-bagla";
    const response = NextResponse.redirect(target);
    response.cookies.delete(`hk_oauth_state_${provider}`);
    response.cookies.delete(`hk_oauth_pkce_${provider}`);
    response.cookies.set(`hk_oauth_session_${provider}`, encryptSession({ provider, customerId: session.companyId, accessToken: token.accessToken, expiresAt, scope: token.scope, metaUser }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 900, path: "/" });
    return response;
  } catch (error) {
    return redirectWithIntegrationError(request, returnTo, provider, "token_exchange_failed", { integration_message: error instanceof Error ? error.message : "OAuth token alınamadı." });
  }
}

export async function oauthAssets(provider: Provider, request: Request) {
  const session = await requireCustomerSession();
  if (!session) return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });
  const config = providerConfig[provider];
  const url = new URL(request.url);
  const platform = url.searchParams.get("platform") || provider;
  const missing = missingProviderEnv(provider);
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

function metaPhase1AccountFromSession(oauthSession: any) {
  const metaUser = oauthSession?.metaUser || {};
  const userId = clean(metaUser.id || metaUser.meta_user_id);
  if (!userId) return null;
  const scopes = providerScopeList("meta");
  return {
    id: `meta-user-${userId}`,
    provider: "meta",
    platform: "meta",
    account_type: "meta_user",
    provider_account_id: userId,
    provider_account_name: clean(metaUser.name || metaUser.meta_user_name || metaUser.email || metaUser.meta_user_email || userId),
    status: "Temel giriş tamamlandı. Reklam hesaplarını listelemek için gelişmiş Meta izinleri gerekir.",
    last_synced_at: new Date().toISOString(),
    scopes,
    metadata: {
      phase: "meta_oauth_phase_1",
      meta_user_id: userId,
      meta_user_name: clean(metaUser.name || metaUser.meta_user_name),
      meta_user_email: clean(metaUser.email || metaUser.meta_user_email),
      advanced_permissions_enabled: false,
      advanced_permissions_note: "Önce temel Facebook Login tamamlandı. Reklam hesabı listeleme için gelişmiş Meta izinleri ayrıca açılmalıdır. Business Verification yoksa reklam hesabı ID'si manuel bağlanabilir."
    }
  };
}

function googleApiErrorMessage(payload: any, fallback: string) {
  const raw = clean(payload?.error?.message || payload?.error_description || payload?.message || payload?.error || fallback);
  const lower = raw.toLocaleLowerCase("tr-TR");
  if (lower.includes("api has not been used") || lower.includes("disabled") || lower.includes("not enabled")) return "Google Cloud’da ilgili API etkinleştirilmelidir.";
  if (lower.includes("permission") || lower.includes("insufficient") || lower.includes("forbidden") || lower.includes("unauthorized")) return "Google hesabında bu varlığı okumak için yetki gerekiyor.";
  if (lower.includes("developer token")) return "Google Ads hesaplarını listelemek için GOOGLE_ADS_DEVELOPER_TOKEN gerekiyor.";
  return raw || fallback;
}

async function googleJson(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {})
    },
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(googleApiErrorMessage(payload, "Google API isteği başarısız oldu."));
  return payload;
}

async function fetchGoogleAccounts(accessToken: string) {
  const user = await googleJson("https://www.googleapis.com/oauth2/v3/userinfo", accessToken).catch((error) => ({ sub: "", email: "", name: error instanceof Error ? error.message : "" }));
  const warnings: string[] = [];
  const accounts: any[] = [{
    id: `google-profile-${user.sub || "authorized"}`,
    provider: "google",
    platform: "google",
    account_type: "google_profile",
    provider_account_id: user.sub || "",
    provider_account_name: user.email || user.name || "Google hesabı doğrulandı",
    status: "Bağlı Google profili",
    category: "Google Profil",
    metadata: { email: user.email || "", note: "Bu profil token doğrulaması için kullanılır; rapor varlığı seçmek için aşağıdaki hesapları seçin." }
  }];
  const [ga4, sites, ads, gbpAccounts] = await Promise.allSettled([
    googleJson("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", accessToken),
    googleJson("https://www.googleapis.com/webmasters/v3/sites", accessToken),
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN
      ? googleJson("https://googleads.googleapis.com/v18/customers:listAccessibleCustomers", accessToken, { headers: { "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN } })
      : Promise.reject(new Error("Google Ads hesaplarını listelemek için GOOGLE_ADS_DEVELOPER_TOKEN gerekiyor.")),
    googleJson("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", accessToken)
  ]);
  if (ga4.status === "fulfilled") {
    const summaries = Array.isArray(ga4.value.accountSummaries) ? ga4.value.accountSummaries : [];
    summaries.flatMap((summary: any) => Array.isArray(summary.propertySummaries) ? summary.propertySummaries : []).forEach((property: any) => {
      accounts.push({ id: `google-ga4-${property.property}`, provider: "google", platform: "google_analytics", category: "GA4 Properties", account_type: "ga4_property", provider_account_id: String(property.property || "").replace("properties/", ""), provider_account_name: property.displayName || property.property, status: "Seçilebilir", metadata: property });
    });
  } else {
    warnings.push(`GA4: ${ga4.reason instanceof Error ? ga4.reason.message : "Google Analytics Admin API verisi alınamadı."}`);
  }
  if (sites.status === "fulfilled") {
    const entries = Array.isArray(sites.value.siteEntry) ? sites.value.siteEntry : [];
    entries.forEach((site: any) => accounts.push({ id: `google-search-${site.siteUrl}`, provider: "google", platform: "search_console", category: "Search Console Siteleri", account_type: "search_console_site", provider_account_id: site.siteUrl, provider_account_name: site.siteUrl, status: site.permissionLevel || "Seçilebilir", metadata: site }));
  } else {
    warnings.push(`Search Console: ${sites.reason instanceof Error ? sites.reason.message : "Search Console siteleri alınamadı."}`);
  }
  if (ads.status === "fulfilled") {
    const resourceNames = Array.isArray(ads.value.resourceNames) ? ads.value.resourceNames : [];
    resourceNames.forEach((resourceName: string) => {
      const customerId = clean(resourceName).replace("customers/", "");
      accounts.push({ id: `google-ads-${customerId}`, provider: "google", platform: "google_ads", category: "Google Ads Hesapları", account_type: "google_ads_customer", provider_account_id: customerId, provider_account_name: `Google Ads Customer ID ${customerId}`, status: "Seçilebilir", metadata: { resourceName } });
    });
  } else {
    warnings.push(`Google Ads: ${ads.reason instanceof Error ? ads.reason.message : "Google Ads erişilebilir müşteri listesi alınamadı."}`);
  }
  if (gbpAccounts.status === "fulfilled") {
    const gbpList = Array.isArray(gbpAccounts.value.accounts) ? gbpAccounts.value.accounts : [];
    for (const account of gbpList.slice(0, 10)) {
      const accountName = clean(account.name);
      accounts.push({ id: `google-business-${accountName}`, provider: "google", platform: "google_business_profile", category: "Business Profile Lokasyonları", account_type: "google_business_profile_account", provider_account_id: accountName, provider_account_name: account.accountName || accountName, status: "Seçilebilir", metadata: account });
      try {
        const locations = await googleJson(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storeCode`, accessToken);
        (Array.isArray(locations.locations) ? locations.locations : []).forEach((location: any) => {
          accounts.push({ id: `google-business-location-${location.name}`, provider: "google", platform: "google_business_profile", category: "Business Profile Lokasyonları", account_type: "google_business_location", provider_account_id: location.name, provider_account_name: location.title || location.name, status: "Seçilebilir", metadata: location });
        });
      } catch (error) {
        warnings.push(`Business Profile lokasyonları: ${error instanceof Error ? error.message : "Lokasyonlar alınamadı."}`);
      }
    }
  } else {
    warnings.push(`Google Business Profile: ${gbpAccounts.reason instanceof Error ? gbpAccounts.reason.message : "Business Profile hesapları alınamadı."}`);
  }
  (accounts as any).warnings = warnings.filter(Boolean);
  return accounts;
}

function googleDiscoveryGroups(accounts: any[], warnings: string[] = []) {
  const groups: Record<string, { status: string; assets: any[]; message: string }> = {
    ga4: { status: "empty", assets: [], message: "GA4 mülkü bulunamadı." },
    search_console: { status: "empty", assets: [], message: "Search Console sitesi bulunamadı." },
    google_ads: { status: "empty", assets: [], message: "Google Ads hesabı bulunamadı." },
    business_profile: { status: "empty", assets: [], message: "Business Profile lokasyonu bulunamadı." },
    youtube: { status: "scope_required", assets: [], message: "YouTube varlıkları için ilgili izin kapsamı gerekir." }
  };
  for (const account of accounts) {
    const type = clean(account.account_type || account.asset_type || account.platform);
    const service = type === "ga4_property" ? "ga4"
      : type === "search_console_site" ? "search_console"
        : type === "google_ads_customer" ? "google_ads"
          : type.includes("google_business") ? "business_profile"
            : type.includes("youtube") ? "youtube"
              : "";
    if (!service || !groups[service]) continue;
    groups[service].assets.push(account);
    groups[service].status = "ok";
    groups[service].message = "Varlıklar listelendi.";
  }
  for (const warning of warnings) {
    const lower = warning.toLocaleLowerCase("tr-TR");
    const service = lower.includes("ga4") ? "ga4"
      : lower.includes("search console") ? "search_console"
        : lower.includes("google ads") ? "google_ads"
          : lower.includes("business profile") ? "business_profile"
            : lower.includes("youtube") ? "youtube"
              : "";
    if (!service || !groups[service] || groups[service].assets.length) continue;
    groups[service].status = lower.includes("developer token") ? "developer_token_required"
      : lower.includes("api") || lower.includes("etkinleştirilmelidir") ? "api_not_enabled"
        : lower.includes("yetki") || lower.includes("permission") ? "permission_required"
          : "warning";
    groups[service].message = warning.replace(/^[^:]+:\s*/, "");
  }
  return groups;
}

async function fetchTikTokAccounts(accessToken: string) {
  const response = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/advertiser/get/", { headers: { "Access-Token": accessToken }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  const list = Array.isArray(payload.data?.list) ? payload.data.list : [];
  return list.map((item: any) => ({
    id: `tiktok-advertiser-${item.advertiser_id || item.id}`,
    provider: "tiktok",
    platform: "tiktok",
    account_type: "advertiser",
    provider_account_id: item.advertiser_id || item.id || "",
    provider_account_name: item.advertiser_name || item.name || "TikTok reklam hesabı",
    status: "Seçilebilir",
    metadata: item
  }));
}

async function fetchXAccounts(accessToken: string) {
  const response = await fetch("https://api.twitter.com/2/users/me?user.fields=username,name,verified,profile_image_url", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  const user = payload.data || {};
  if (!response.ok || !user.id) throw new Error(payload.detail || payload.title || "X/Twitter profil bilgisi alınamadı.");
  return [{
    id: `x-profile-${user.id}`,
    provider: "x",
    platform: "x_twitter",
    account_type: "x_profile",
    provider_account_id: user.id,
    provider_account_name: user.username ? `@${user.username}` : user.name || user.id,
    status: "Seçilebilir; X Ads hesabı için ek API onayı gerekebilir.",
    metadata: { username: user.username || "", name: user.name || "", verified: Boolean(user.verified) }
  }];
}

export async function oauthAccounts(request: Request) {
  const session = await requireIntegrationSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekir." }, { status: 403 });
  const provider = clean(new URL(request.url).searchParams.get("provider")) as Provider;
  if (!["meta", "google", "tiktok", "x"].includes(provider)) return NextResponse.json({ error: "Geçerli platform seçin." }, { status: 400 });
  const missing = missingProviderEnv(provider);
  if (missing.length) return NextResponse.json({ ok: false, provider, accounts: [], code: "oauth_not_configured", missingEnv: missing, message: "Bağlantı yapılandırması eksik." }, { status: 501 });
  const cookieStore = await cookies();
  const oauthSession = decryptSession(cookieStore.get(`hk_oauth_session_${provider}`)?.value);
  let accessToken = "";
  let metaSessionForPhase1 = oauthSession;
  if (oauthSession && oauthSession.provider === provider && (!isCustomerRole(session.role) || oauthSession.customerId === session.companyId)) {
    accessToken = String(oauthSession.accessToken || "");
  } else if (provider === "meta" && isCustomerRole(session.role) && session.companyId) {
    const stored = await tokenForCustomerMetaIntegration(session.companyId);
    accessToken = stored.token;
    metaSessionForPhase1 = { provider, customerId: session.companyId, metaUser: stored.integration?.metadata || {} };
  }
  if (!accessToken) {
    return NextResponse.json({ ok: false, provider, accounts: [], code: "oauth_session_missing", message: "Hesap listelemek için önce platform girişini tamamlayın." }, { status: 401 });
  }
  try {
    if (provider === "meta" && !advancedScopesEnabled("meta")) {
      const phase1Account = metaPhase1AccountFromSession(metaSessionForPhase1);
      const diagnostics = publicMetaDiagnostics(await diagnoseMetaBusinessAccess(accessToken, false));
      return NextResponse.json({
        ok: true,
        provider,
        accounts: phase1Account ? [phase1Account] : [],
        phase: "meta_oauth_phase_1",
        advancedScopesEnabled: false,
        diagnostics,
        message: "Reklam hesaplarını listelemek için gelişmiş Meta izinleri gerekir. Önce temel giriş tamamlandı."
      });
    }
    if (provider === "meta") {
      const result = await listMetaBusinessAssets(accessToken);
      return NextResponse.json({ ok: true, provider, accounts: result.accounts, groups: result.groups, warnings: result.warnings, diagnostics: result.diagnostics, phase: "meta_business_phase_2", advancedScopesEnabled: true, message: result.message });
    }
    const accounts = provider === "google" ? await fetchGoogleAccounts(accessToken) : provider === "tiktok" ? await fetchTikTokAccounts(accessToken) : await fetchXAccounts(accessToken);
    const warnings = (accounts as any).warnings || [];
    return NextResponse.json({
      ok: true,
      provider,
      accounts,
      groups: provider === "google" ? googleDiscoveryGroups(accounts, warnings) : undefined,
      warnings,
      message: accounts.length > 1 ? "Yetkili hesaplar listelendi." : "Temel profil doğrulandı; rapor varlığı bulunamadı veya ilgili Google API/izin bekleniyor."
    });
  } catch (error) {
    return NextResponse.json({ ok: false, provider, accounts: [], code: "provider_fetch_failed", message: error instanceof Error ? error.message : "Yetkili hesaplar alınamadı." }, { status: 502 });
  }
}

export async function selectOAuthAccount(request: Request) {
  const session = await requireIntegrationSession();
  if (!session || !isCustomerRole(session.role) || !session.companyId) return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const inputs = Array.isArray(body.accounts) && body.accounts.length ? body.accounts : [body];
  const normalizedInputs = inputs.map((item: any) => ({
    provider: clean(item.provider || body.provider),
    platform: clean(item.platform || body.platform || item.provider || body.provider),
    providerAccountId: clean(item.provider_account_id || item.account_id || item.asset_id),
    providerAccountName: clean(item.provider_account_name || item.asset_name || item.name),
    accountType: clean(item.account_type || item.asset_type || item.platform || body.account_type || body.asset_type),
    scopes: Array.isArray(item.scopes || body.scopes) ? (item.scopes || body.scopes).map(clean).filter(Boolean) : [],
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {}
  })).filter((item: any) => item.provider && item.platform && item.providerAccountId);
  if (!normalizedInputs.length) return NextResponse.json({ error: "Kaydetmek için en az bir geçerli hesap seçin." }, { status: 400 });
  try {
    const existingRows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(session.companyId)}&select=*&limit=1`).catch(() => []);
    const existing = existingRows[0] || null;
    const currentAssets = Array.isArray(existing?.integration_assets) ? existing.integration_assets : [];
    const now = new Date().toISOString();
    const newAssets = normalizedInputs.map((item: any) => ({
      id: `${item.provider}-${item.accountType}-${item.providerAccountId}`,
      provider: item.provider,
      platform: item.platform,
      platform_label: providerConfig[item.provider as Provider]?.label || item.provider,
      asset_type: item.accountType,
      asset_name: item.providerAccountName || item.providerAccountId,
      asset_id: item.providerAccountId,
      account_id: item.providerAccountId,
      provider_account_id: item.providerAccountId,
      provider_account_name: item.providerAccountName || item.providerAccountId,
      account_type: item.accountType,
      status: "connected_oauth",
      source: "customer",
      connection_mode: "oauth",
      connection_method: "oauth",
      admin_review_status: "approved",
      oauth_status: "connected",
      last_synced_at: now,
      metadata: item.metadata
    }));
    const newKeys = new Set(newAssets.map((item: any) => `${item.provider || item.platform}-${item.account_type || item.asset_type}-${item.provider_account_id || item.account_id || item.asset_id}`));
    const nextAssets = [...newAssets, ...currentAssets.filter((item: any) => !newKeys.has(`${item.provider || item.platform}-${item.account_type || item.asset_type}-${item.provider_account_id || item.account_id || item.asset_id}`))];
    const primary = newAssets[0];
    const patch = {
      company_id: session.companyId,
      provider: primary.provider,
      provider_account_id: primary.provider_account_id,
      provider_account_name: primary.provider_account_name,
      account_type: primary.account_type,
      status: "connected_oauth",
      source: "customer",
      connection_mode: "oauth",
      connection_method: "oauth",
      admin_review_status: "approved",
      oauth_status: "connected",
      oauth_account_id: primary.provider_account_id,
      oauth_asset_id: primary.provider_account_id,
      oauth_asset_type: primary.account_type,
      scopes: normalizedInputs.flatMap((item: any) => item.scopes),
      metadata: primary.metadata || {},
      integration_assets: nextAssets,
      last_synced_at: now,
      updated_by: session.profileId || null,
      created_by: existing?.created_by || session.profileId || null
    };
    const rows = await supabaseRest<any[]>("customer_integrations?on_conflict=company_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(patch) });
    return NextResponse.json({ ok: true, integration: rows[0], assets: nextAssets, savedCount: newAssets.length, message: `${newAssets.length} hesap bağlandı ve admin paneline aktarıldı.` });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

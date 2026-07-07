/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getSession, isCustomerRole, isStaffRole } from "@/lib/auth";
import { encryptSecret } from "@/lib/business-flow";
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
  advancedScope?: string;
  assetTypes: string[];
}> = {
  meta: {
    label: "Meta",
    env: ["META_CLIENT_ID", "META_CLIENT_SECRET", "META_REDIRECT_URI"],
    authBase: "https://www.facebook.com/v20.0/dialog/oauth",
    scope: "public_profile,email",
    advancedScope: "business_management,ads_read,pages_show_list,instagram_basic",
    assetTypes: ["Business Manager", "Ad Account", "Page", "Instagram Business Account", "Pixel"]
  },
  google: {
    label: "Google",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    authBase: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/youtube.readonly openid email profile",
    assetTypes: ["Google Ads Customer", "GA4 Property", "YouTube Channel", "Search Console Site"]
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
  const config = providerConfig[provider];
  if (!advancedScopesEnabled(provider) || !config.advancedScope) return config.scope;
  return `${config.scope},${config.advancedScope}`;
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
    advancedScopesEnabled: advancedScopesEnabled(provider),
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
  const state = encodeState({ provider, platform, customerId: session.companyId, returnTo, nonce, exp: Date.now() + 10 * 60 * 1000 });
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

async function fetchMetaAccounts(accessToken: string) {
  const endpoints = [
    ["meta_business", "Business hesapları", `https://graph.facebook.com/v20.0/me/businesses?fields=id,name&access_token=${encodeURIComponent(accessToken)}`],
    ["meta_ad_account", "Reklam hesapları", `https://graph.facebook.com/v20.0/me/adaccounts?fields=id,name,account_status,currency&access_token=${encodeURIComponent(accessToken)}`],
    ["facebook_page", "Facebook sayfaları", `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(accessToken)}`]
  ];
  const groups = await Promise.all(endpoints.map(async ([type, label, endpoint]) => {
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    return { type, label, ok: response.ok, data: Array.isArray(payload.data) ? payload.data : [], error: payload.error?.message || "" };
  }));
  return groups.flatMap((group) => group.data.flatMap((item: any) => {
    const base = {
      id: `meta-${group.type}-${item.id}`,
      provider: "meta",
      platform: group.type === "facebook_page" ? "facebook" : "meta",
      account_type: group.type,
      provider_account_id: item.id,
      provider_account_name: item.name || item.id,
      status: item.account_status ? `Durum: ${item.account_status}` : "Seçilebilir",
      metadata: item
    };
    const instagram = item.instagram_business_account ? [{
      id: `meta-instagram_business-${item.instagram_business_account.id}`,
      provider: "meta",
      platform: "instagram",
      account_type: "instagram_business",
      provider_account_id: item.instagram_business_account.id,
      provider_account_name: item.instagram_business_account.username || item.instagram_business_account.name || item.instagram_business_account.id,
      status: "Seçilebilir",
      metadata: { page_id: item.id, ...item.instagram_business_account }
    }] : [];
    return [base, ...instagram];
  }));
}

function metaPhase1AccountFromSession(oauthSession: any) {
  const metaUser = oauthSession?.metaUser || {};
  const userId = clean(metaUser.id);
  if (!userId) return null;
  const scopes = providerScopeList("meta");
  return {
    id: `meta-user-${userId}`,
    provider: "meta",
    platform: "meta",
    account_type: "meta_user",
    provider_account_id: userId,
    provider_account_name: clean(metaUser.name || metaUser.email || userId),
    status: "Temel giriş tamamlandı. Reklam hesaplarını listelemek için gelişmiş Meta izinleri gerekir.",
    last_synced_at: new Date().toISOString(),
    scopes,
    metadata: {
      phase: "meta_oauth_phase_1",
      meta_user_id: userId,
      meta_user_name: clean(metaUser.name),
      meta_user_email: clean(metaUser.email),
      advanced_permissions_enabled: false,
      advanced_permissions_note: "Önce temel Facebook Login tamamlandı. Reklam hesabı listeleme için gelişmiş Meta izinleri ayrıca açılmalıdır."
    }
  };
}

async function fetchGoogleAccounts(accessToken: string) {
  const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const user = await userResponse.json().catch(() => ({}));
  const accounts: any[] = [{
    id: `google-profile-${user.sub || "authorized"}`,
    provider: "google",
    platform: "google_ads",
    account_type: "google_ads_customer",
    provider_account_id: user.sub || "",
    provider_account_name: user.email || user.name || "Google hesabı doğrulandı",
    status: process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? "Seçilebilir" : "Google Ads hesaplarını listelemek için GOOGLE_ADS_DEVELOPER_TOKEN gerekiyor.",
    metadata: { email: user.email || "", note: "Google Ads varlıkları için developer token gerekebilir." }
  }];
  const [ga4, sites, youtube] = await Promise.allSettled([
    fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }).then((response) => response.json()),
    fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }).then((response) => response.json()),
    fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }).then((response) => response.json())
  ]);
  if (ga4.status === "fulfilled") {
    const summaries = Array.isArray(ga4.value.accountSummaries) ? ga4.value.accountSummaries : [];
    summaries.flatMap((summary: any) => Array.isArray(summary.propertySummaries) ? summary.propertySummaries : []).forEach((property: any) => {
      accounts.push({ id: `google-ga4-${property.property}`, provider: "google", platform: "google_analytics", account_type: "ga4_property", provider_account_id: String(property.property || "").replace("properties/", ""), provider_account_name: property.displayName || property.property, status: "Seçilebilir", metadata: property });
    });
  }
  if (sites.status === "fulfilled") {
    const entries = Array.isArray(sites.value.siteEntry) ? sites.value.siteEntry : [];
    entries.forEach((site: any) => accounts.push({ id: `google-search-${site.siteUrl}`, provider: "google", platform: "search_console", account_type: "search_console_site", provider_account_id: site.siteUrl, provider_account_name: site.siteUrl, status: site.permissionLevel || "Seçilebilir", metadata: site }));
  }
  if (youtube.status === "fulfilled") {
    const channels = Array.isArray(youtube.value.items) ? youtube.value.items : [];
    channels.forEach((channel: any) => accounts.push({ id: `google-youtube-${channel.id}`, provider: "google", platform: "youtube", account_type: "youtube_channel", provider_account_id: channel.id, provider_account_name: channel.snippet?.title || channel.id, status: "Seçilebilir", metadata: { title: channel.snippet?.title || "" } }));
  }
  return accounts;
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
  if (!oauthSession || oauthSession.provider !== provider || (isCustomerRole(session.role) && oauthSession.customerId !== session.companyId)) {
    return NextResponse.json({ ok: false, provider, accounts: [], code: "oauth_session_missing", message: "Hesap listelemek için önce platform girişini tamamlayın." }, { status: 401 });
  }
  try {
    const accessToken = String(oauthSession.accessToken || "");
    if (provider === "meta" && !advancedScopesEnabled("meta")) {
      const phase1Account = metaPhase1AccountFromSession(oauthSession);
      return NextResponse.json({
        ok: true,
        provider,
        accounts: phase1Account ? [phase1Account] : [],
        phase: "meta_oauth_phase_1",
        advancedScopesEnabled: false,
        message: "Reklam hesaplarını listelemek için gelişmiş Meta izinleri gerekir. Önce temel giriş tamamlandı."
      });
    }
    const accounts = provider === "meta" ? await fetchMetaAccounts(accessToken) : provider === "google" ? await fetchGoogleAccounts(accessToken) : provider === "tiktok" ? await fetchTikTokAccounts(accessToken) : await fetchXAccounts(accessToken);
    return NextResponse.json({ ok: true, provider, accounts, message: accounts.length ? "Yetkili hesaplar listelendi." : "Hesap bulunamadı veya yetki kapsamı yetersiz." });
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

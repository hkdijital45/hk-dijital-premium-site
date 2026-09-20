/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getSession, isCustomerPasswordChangeRequired, isCustomerRole, isStaffRole, requireCustomerSession } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { HIDDEN_ACCESS_COOKIE, HIDDEN_ACCESS_SESSION_TTL_SECONDS, extractClientIp, findValidHiddenAccessSession, grantCourtesyHiddenAccessSession } from "@/lib/hidden-access";
import { encryptSecret } from "@/lib/business-flow";
import { diagnoseMetaBusinessAccess, listMetaBusinessAssets, META_BUSINESS_REQUIRED_SCOPES, publicMetaDiagnostics, tokenForCustomerMetaIntegration } from "@/lib/meta-business-phase2";
import { getGoogleToken } from "@/lib/google-oauth-token";
import { getTikTokToken } from "@/lib/tiktok-oauth-token";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { safeCompare } from "@/lib/secure-compare";
import { safeReturnTo } from "@/lib/safe-return-to";

export type Provider = "meta" | "google" | "tiktok" | "x";
// origin identifies which authenticated context started the OAuth handshake
// (a customer at /musteri-paneli vs an HK Admin staff member previewing a
// company from /hk-admin/analiz-raporlama). It travels inside the signed
// state, never as a trusted client value, so oauthCallback can safely
// determine which session type/return route is valid for this handshake —
// see oauthConnect/oauthCallback.
// "connect_link" added for HK Connect's remote connection links: a
// customer opens /connect/<token> (no HK Admin login, no customer
// session) and starts this same OAuth flow — see the new branch in
// oauthConnect/oauthCallback below. The token itself is validated
// against public.customer_connect_tokens (src/lib/connect-links.ts)
// before this origin is ever assigned; nothing here trusts a client
// value for it.
type OAuthOrigin = "customer_panel" | "hk_admin" | "connect_link";
type OAuthState = {
  provider: Provider;
  platform: string;
  customerId: string;
  origin: OAuthOrigin;
  returnTo: string;
  nonce: string;
  exp: number;
  connectTokenId?: string;
};

export async function companyExistsForStaff(companyId: string): Promise<boolean> {
  if (!companyId || !hasSupabaseConfig()) return false;
  const rows = await supabaseRest<any[]>(`companies?select=id&id=eq.${encodeURIComponent(companyId)}&deleted_at=is.null&limit=1`).catch(() => []);
  return Boolean(rows[0]?.id);
}

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
    authBase: "https://www.facebook.com/v23.0/dialog/oauth",
    scope: "public_profile,email",
    assetTypes: ["Business Manager", "Ad Account", "Page", "Instagram Business Account", "Pixel"]
  },
  google: {
    label: "Google",
    env: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"],
    authBase: "https://accounts.google.com/o/oauth2/v2/auth",
    // youtube.readonly (Data API v3) covers channel discovery only —
    // yt-analytics.readonly (YouTube Analytics API v2) is a SEPARATE scope
    // required for syncYoutubeAnalytics's real metrics (views, watch time,
    // subscribers) in analytics-center/providers/youtube.ts. Missing here
    // previously — a real gap confirmed against a live, already-connected
    // production Google login whose granted scopes had youtube.readonly
    // but not yt-analytics.readonly. Anyone already connected before this
    // change needs to reconnect once (Google OAuth is not retroactive) —
    // see docs/analytics-center/setup.md.
    scope: "openid email profile https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/business.manage https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
    assetTypes: ["Google Ads Customer", "GA4 Property", "Search Console Site", "Google Business Profile", "YouTube Channel"]
  },
  // TikTok Login Kit (developers.tiktok.com/doc/login-kit-web) — the
  // official, current OAuth product for reading a user's own profile/video
  // data via open.tiktokapis.com. Deliberately NOT
  // business-api.tiktok.com/portal/auth (TikTok's separate Business/Ads
  // API, a different product for managing ad accounts — this app was
  // previously, incorrectly, configured against that one, which explains
  // why it never actually worked for analytics: wrong auth host, wrong
  // param names (app_id instead of client_key), wrong scope set, wrong
  // token endpoint). Minimum read-only scopes only — no publishing
  // permission requested.
  tiktok: {
    label: "TikTok",
    env: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI"],
    authBase: "https://www.tiktok.com/v2/auth/authorize/",
    scope: "user.info.basic,user.info.profile,user.info.stats,video.list",
    assetTypes: ["TikTok Account"]
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

function publicIntegrationRecord(integration: any) {
  if (!integration || typeof integration !== "object") return integration;
  const safe = { ...integration };
  [
    "access_token",
    "refresh_token",
    "access_token_encrypted",
    "refresh_token_encrypted",
    "sensitive_metadata",
    "client_secret",
    "app_secret"
  ].forEach((key) => delete safe[key]);
  return safe;
}

function baseUrl(request: Request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function wantsJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") || new URL(request.url).searchParams.get("format") === "json";
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
    // The confirmed-working app (META_APP_ID/META_CLIENT_ID) was created as
    // a Consumer-type app — Meta app types are immutable and Consumer apps
    // cannot add the Facebook Login for Business / Instagram Graph API use
    // cases (confirmed live: its "Add use cases" dialog shows none
    // available). A Configuration (META_LOGIN_CONFIG_ID) can therefore only
    // ever belong to a genuinely different, dedicated Business-type app —
    // never to META_APP_ID. To make a client_id/config_id mismatch
    // structurally impossible, the two travel together as one atomic unit:
    // see metaBusinessCredentials().
    const business = metaBusinessCredentials();
    if (business) {
      return { clientId: business.clientId, clientSecret: business.clientSecret, redirectUri: process.env.META_REDIRECT_URI || "" };
    }
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

// Whether a Meta connection can be expected to carry business/Instagram/
// Page permissions. Previously gated on META_ADVANCED_SCOPES_ENABLED, a
// boolean that was checked in several places (this function, the
// oauthAccounts Phase-1/Phase-2 branch, saveMetaPhase1Integration's stored
// metadata) but never actually reached the OAuth request itself — flipping
// it did nothing to what was requested. The real, current gate is whether a
// dedicated Facebook Login for Business app + Configuration is fully set up
// — see metaBusinessCredentials().
export function advancedScopesEnabled(provider: Provider) {
  return provider === "meta" && Boolean(metaBusinessCredentials());
}

// Real production root cause of "Meta login succeeds but Instagram/Facebook
// never connect": this previously always returned providerConfig.meta's
// bare "public_profile,email" for Meta regardless of
// META_ADVANCED_SCOPES_ENABLED — the flag was checked in several places
// (businessAssetListingReady, the oauthAccounts Phase-1/Phase-2 branch,
// saveMetaPhase1Integration's stored metadata) but never actually reached
// the OAuth authorize request itself, so the resulting token could never
// have pages_show_list/instagram_basic/business_management/etc. no matter
// how the flag was set — confirmed against the real production
// customer_integrations row (oauth_scopes: ["public_profile","email"] only)
// for a company where META_ADVANCED_SCOPES_ENABLED is already true. Now
// actually requests the full, current (verified against Meta's own
// permissions reference) business/insights scope set once the flag is on.
// IMPORTANT: this Meta App (META_APP_ID) is confirmed live, in its own Meta
// Dashboard, to be a Consumer-type app whose "Add use cases" screen has no
// more use cases available — it structurally cannot support Facebook
// Login for Business/Instagram Graph API at all (app type is immutable). A
// raw scope list of asset-level permissions (pages_show_list,
// instagram_basic, etc.) sent to it is rejected outright as Invalid Scopes
// (confirmed live, in production — this was the real, root cause: a prior
// version of this function tried widening the scope list on this same app
// when META_ADVANCED_SCOPES_ENABLED was on, which broke basic Meta login
// entirely). The advanced permission set is only ever requested via a
// dedicated, separate Business-type app's config_id (see
// metaBusinessCredentials()/oauthConnect); this always stays at the safe,
// always-valid baseline for META_APP_ID itself.
function effectiveProviderScope(provider: Provider) {
  return providerConfig[provider].scope;
}

// A dedicated Facebook Login for Business app's credentials + its
// Configuration ID, treated as one atomic, all-or-nothing unit. Deliberately
// NOT layered onto META_APP_ID/META_CLIENT_ID (the existing, working
// Consumer-type app used for basic public_profile,email login) — Meta app
// types are immutable, that app's own "Add use cases" dialog confirms no
// more use cases (incl. Facebook Login for Business) can ever be added to
// it, so a config_id can only ever be valid against a genuinely different
// app's client_id. Requiring all three env vars together makes a
// mismatched client_id/config_id pairing (silently sent to Meta, rejected
// as Invalid Scopes or a similar hard error) structurally impossible — a
// partially-set trio is treated as fully absent, never a partial fallback.
// Set up in Meta App Dashboard → (dedicated Business-type app) → Facebook
// Login for Business → Configurations → Create configuration → select the
// Pages/Instagram assets and permissions the Configuration should grant →
// copy its Configuration ID, App ID and App Secret here. See
// docs/analytics-center/setup.md for the full walkthrough.
function metaBusinessCredentials(): { clientId: string; clientSecret: string; configId: string } | null {
  const clientId = (process.env.META_BUSINESS_CLIENT_ID || "").trim();
  const clientSecret = (process.env.META_BUSINESS_CLIENT_SECRET || "").trim();
  const configId = (process.env.META_LOGIN_CONFIG_ID || "").trim();
  if (!clientId || !clientSecret || !configId) return null;
  return { clientId, clientSecret, configId };
}

// True when SOME but not all of the business trio is set — a real,
// actionable misconfiguration (never silently ignored) distinct from
// "fully not configured".
function metaBusinessCredentialsPartial(): boolean {
  const clientId = Boolean((process.env.META_BUSINESS_CLIENT_ID || "").trim());
  const clientSecret = Boolean((process.env.META_BUSINESS_CLIENT_SECRET || "").trim());
  const configId = Boolean((process.env.META_LOGIN_CONFIG_ID || "").trim());
  const setCount = [clientId, clientSecret, configId].filter(Boolean).length;
  return setCount > 0 && setCount < 3;
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
    client_key: "<configured>",
    redirect_uri: redirectUri || expectedRedirectUris[provider],
    response_type: "code",
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
    businessConfigPartiallySet: provider === "meta" ? metaBusinessCredentialsPartial() : undefined,
    businessAssetListingReady: provider === "meta" ? advancedScopesEnabled(provider) : undefined,
    businessAssetListingMessage: provider === "meta"
      ? advancedScopesEnabled(provider)
        ? "META_BUSINESS_CLIENT_ID/SECRET + META_LOGIN_CONFIG_ID (ayrı, Business tipi bir Meta App) tanımlı — OAuth ekranı bu App'in config_id'sini kullanır, gelişmiş izinler (Facebook Sayfaları, Instagram Business) Configuration içinde seçilmiş olmalı. Meta bu izinleri, hesap o App'in admin/geliştirici/test kullanıcısı ise (Standard Access) hemen, değilse yalnızca App Review onayından sonra (Advanced Access) verir."
        : metaBusinessCredentialsPartial()
          ? "META_BUSINESS_CLIENT_ID / META_BUSINESS_CLIENT_SECRET / META_LOGIN_CONFIG_ID üçlüsünden yalnızca bir kısmı tanımlı — eksik değişken(ler) tamamlanana kadar bu üçü birlikte yok sayılır (kısmi/karışık bir App ID + Configuration eşleşmesi Meta tarafından reddedilir), OAuth login güvenli şekilde public_profile,email temel girişine düşer."
          : "Gelişmiş izinler için ayrı, Business tipinde bir Meta App gerekir (mevcut ana App bir Consumer tipi App'tir — Meta app tipleri değiştirilemez ve bu App'in 'Add use cases' ekranı Facebook Login for Business/Instagram Graph API için uygun kullanım durumu kalmadığını doğruladı). O App'in Configuration ID'si + kendi App ID/Secret'ı META_BUSINESS_CLIENT_ID / META_BUSINESS_CLIENT_SECRET / META_LOGIN_CONFIG_ID olarak tanımlanana kadar OAuth login güvenli şekilde public_profile,email temel girişinde kalır; reklam hesabı manuel ID ile bağlanabilir."
      : undefined,
    businessPermissionNote: provider === "meta" ? "business_management, ads_read, pages_show_list, pages_read_engagement, instagram_basic, instagram_manage_insights hiçbir zaman ana App'in (META_APP_ID/META_CLIENT_ID) ham scope listesine eklenmez — bu App Consumer tipinde olduğu için Facebook Login for Business/Instagram Graph API kullanım durumlarını hiç desteklemiyor (Meta Dashboard'da doğrulandı). Bu izinler yalnızca ayrı, Business tipinde bir App'te oluşturulan bir Configuration (config_id) üzerinden istenir." : undefined,
    manualAdAccountSupported: provider === "meta" ? true : undefined,
    manualFallbackMessage: provider === "meta" ? "Business Verification yokken önerilen mod: Meta reklam hesabı ID'sini manuel bağlayın. ads_read onayı geldiğinde aynı kayıt üzerinden insight çekimi denenir." : undefined,
    googleApiNotes: provider === "google" ? [
      "GA4 için Google Analytics Admin/Data API etkin olmalı.",
      "Search Console için Webmasters API etkin olmalı.",
      "Google Ads için GOOGLE_ADS_DEVELOPER_TOKEN ve erişilebilir müşteri hesabı gerekir.",
      "Google Business Profile için Business Profile API erişimi gerekir.",
      "YouTube kanal keşfi için YouTube Data API v3 ve youtube.readonly izin kapsamı gerekir."
    ] : undefined,
    redirectUri: credentials.redirectUri,
    expectedRedirectUri,
    redirectUriMatches,
    authorizeUrlPreview: buildAuthorizePreview(provider, credentials.redirectUri || expectedRedirectUri)
  };
}

function stateSecret() {
  const configured = firstEnv(["OAUTH_STATE_SECRET", "NEXTAUTH_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "META_APP_SECRET", "META_CLIENT_SECRET"]);
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    // No real secret configured — refuse to sign/encrypt OAuth state and
    // session cookies with a guessable, hardcoded string in production.
    throw new Error("OAuth state/oturum imzalamak için gerekli secret env değişkenlerinden hiçbiri üretimde tanımlı değil.");
  }
  return "hk-dijital-local-oauth-state";
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
  if (!payload || !signature) return null;
  let expectedSignature: string;
  try {
    expectedSignature = sign(payload);
  } catch {
    // stateSecret() only throws when production has no real secret configured
    // — treat that as an invalid state (fail closed) instead of a raw 500.
    return null;
  }
  if (!safeCompare(expectedSignature, signature)) return null;
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

async function requireIntegrationSession() {
  const session = await getSession();
  if (!session) return null;
  if (isCustomerPasswordChangeRequired(session)) return null;
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
  // Same config_id-vs-scope branching as oauthConnect — this JSON-mode path
  // (oauthStart) must never independently send the raw business scope list
  // to whichever app clientId now resolves to, or it reintroduces the exact
  // "Invalid Scopes" failure oauthConnect was fixed for.
  const configId = provider === "meta" ? (metaBusinessCredentials()?.configId || "") : "";
  if (configId) params.set("config_id", configId);
  else params.set("scope", scope);
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

// /hk-admin and /musteri-paneli both sit behind the Secret Access Control
// Center (src/proxy.ts), a separate, short-lived (1h) gate in front of the
// real login system. The external provider's own consent flow (picking an
// account, 2FA, reviewing scopes) can easily take long enough for that gate
// to expire while the browser is away — the request never touches our
// server during that time, so nothing here could renew it — and the user
// comes back to a real, valid hk_auth_session but a bounce to the public
// homepage (proxy.ts's requiresSecretGate() failure path), which looks
// exactly like "the flow just gave up." Reuses the same courtesy-session
// mechanism already used for password-reset/admin-setup (see
// grantCourtesyHiddenAccessSession's own comment) — never granted from
// nothing, only refreshed when the incoming request already carries a
// currently-valid one, so this can't be used to skip the gate's real
// first-time entry requirement.
//
// Called at BOTH oauthConnect (before the browser leaves for the external
// provider) and oauthCallback (right after re-verifying the real admin
// session on the way back) for defense in depth: the connect-time refresh
// covers the common case, the callback-time one covers a round trip that
// somehow outlasts even the freshly-extended window.
//
// sameSite MUST be "lax", not "strict" (unlike the password-reset/
// admin-setup courtesy sessions, which only ever get read back on a
// same-site-initiated request). This cookie has to survive being read back
// on the request that follows a real cross-site redirect chain (Google/
// Meta's own server redirecting the browser back to us) — a Strict cookie
// is never attached to that request even though the browser stored it
// correctly, which is exactly what made the previous connect-time-only,
// Strict-cookie refresh silently fail to reach proxy.ts's gate check on the
// return leg (confirmed via production runtime log trace analysis, not
// guessed). hk_auth_session itself already uses Lax for this same reason —
// it's the one cookie that reliably survived every hop.
async function refreshHiddenAccessOnResponse(response: NextResponse, profileId: string | null, request: Request, stage: "oauthConnect" | "oauthCallback") {
  try {
    const currentSecretToken = (await cookies()).get(HIDDEN_ACCESS_COOKIE)?.value;
    if (!currentSecretToken || !(await findValidHiddenAccessSession(currentSecretToken))) return;
    const refreshedToken = await grantCourtesyHiddenAccessSession({
      triggerMethod: stage === "oauthConnect" ? "oauth_connect" : "oauth_callback",
      authenticatedUserId: profileId,
      ipAddress: extractClientIp(request.headers),
      userAgent: request.headers.get("user-agent") || ""
    });
    if (refreshedToken) {
      response.cookies.set(HIDDEN_ACCESS_COOKIE, refreshedToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: HIDDEN_ACCESS_SESSION_TTL_SECONDS });
    }
    logOAuthStage("hidden_access_refresh", request, { stage, refreshed: Boolean(refreshedToken) });
  } catch (error) {
    // Never let this courtesy refresh block the actual OAuth redirect.
    logOAuthStage("hidden_access_refresh", request, { stage, refreshed: false, error: error instanceof Error ? error.message : "unknown_error" });
  }
}

export async function oauthConnect(provider: Provider, request: Request) {
  const url = new URL(request.url);
  const requestedCompany = clean(url.searchParams.get("company") || url.searchParams.get("customerId"));
  const rawReturnTo = clean(url.searchParams.get("returnTo")) || clean(url.searchParams.get("returnUrl"));

  // Two valid ways to reach this endpoint: (1) a customer session managing
  // their own company's connections, unchanged from before; (2) an HK Admin
  // staff session with access to the Analiz & Raporlama Merkezi module,
  // previewing/managing a specific company's connections (?company=<id>,
  // already sent by CustomerAccountConnectCenter when it's rendered in
  // staff-preview mode). The origin is derived from the *server-verified*
  // session type here — never trusted from a client flag — and carried
  // forward inside the signed OAuth state for oauthCallback to consume.
  const customerSession = await requireCustomerSession();
  let origin: OAuthOrigin = "customer_panel";
  let targetCompanyId = "";
  let requesterProfileId: string | null = null;
  let connectTokenId: string | undefined;
  let connectTokenRawValue = "";

  if (customerSession) {
    targetCompanyId = customerSession.companyId;
    requesterProfileId = customerSession.profileId || null;
    if (requestedCompany && requestedCompany !== customerSession.companyId) {
      const returnTo = safeReturnTo(rawReturnTo || "/musteri-paneli#hesap-bagla");
      if (wantsJson(request)) return NextResponse.json({ ok: false, error: "COMPANY_MISMATCH", message: "Bu bağlantı isteği mevcut müşteri oturumuyla eşleşmiyor." }, { status: 403 });
      return redirectWithIntegrationError(request, returnTo, provider, "company_mismatch");
    }
  } else {
    const staffSession = await getSession();
    const isAuthorizedStaff = Boolean(staffSession && isStaffRole(staffSession.role) && canAccessModule(staffSession, "analiz-raporlama"));
    const connectTokenRaw = clean(url.searchParams.get("connectToken"));

    if (isAuthorizedStaff && requestedCompany) {
      if (!(await companyExistsForStaff(requestedCompany))) {
        const returnTo = safeReturnTo(rawReturnTo || "/hk-admin/analiz-raporlama");
        if (wantsJson(request)) return NextResponse.json({ ok: false, error: "COMPANY_MISMATCH", message: "Geçerli bir müşteri seçin." }, { status: 403 });
        return redirectWithIntegrationError(request, returnTo, provider, "company_mismatch");
      }
      origin = "hk_admin";
      targetCompanyId = requestedCompany;
      requesterProfileId = staffSession!.profileId || null;
    } else if (connectTokenRaw) {
      // HK Connect remote connection link — no HK Admin/customer session
      // at all by design; the token itself (validated against
      // public.customer_connect_tokens, hash-only, never the raw value) is
      // the sole authorization for which company this handshake is for.
      connectTokenRawValue = connectTokenRaw;
      const { validateConnectToken, META_CAPABILITIES, GOOGLE_CAPABILITIES } = await import("@/lib/connect-links");
      const validated = await validateConnectToken(connectTokenRaw);
      const returnTo = safeReturnTo(rawReturnTo || `/connect/${connectTokenRaw}`);
      if (!validated.valid) {
        if (wantsJson(request)) return NextResponse.json({ ok: false, error: "TOKEN_INVALID", message: "Bağlantı linki geçersiz veya süresi dolmuş." }, { status: 403 });
        return redirectWithIntegrationError(request, returnTo, provider, "token_invalid");
      }
      // Provider must actually be part of what the admin requested for this
      // link — a customer can't unlock an unrequested provider by editing
      // the URL (provider param is still checked normally below too).
      const providerCapabilities = provider === "meta" ? META_CAPABILITIES : provider === "google" ? GOOGLE_CAPABILITIES : [];
      if (!providerCapabilities.some((c) => validated.requestedCapabilities.includes(c))) {
        if (wantsJson(request)) return NextResponse.json({ ok: false, error: "CAPABILITY_NOT_REQUESTED", message: "Bu bağlantı için bu platform istenmemiş." }, { status: 403 });
        return redirectWithIntegrationError(request, returnTo, provider, "capability_not_requested");
      }
      origin = "connect_link";
      targetCompanyId = validated.companyId;
      connectTokenId = validated.id;
      requesterProfileId = null;
    } else {
      const returnTo = safeReturnTo(rawReturnTo || "/musteri-paneli#hesap-bagla");
      if (wantsJson(request)) {
        return NextResponse.json({ ok: false, error: "SESSION_MISSING", message: "Oturum doğrulanamadı. Lütfen panelden çıkış yapıp tekrar giriş yapın." }, { status: 401 });
      }
      return redirectWithIntegrationError(request, returnTo, provider, "session_missing");
    }
  }

  const returnTo = safeReturnTo(rawReturnTo || (origin === "hk_admin" ? "/hk-admin/analiz-raporlama" : origin === "connect_link" ? `/connect/${connectTokenRawValue}?status=processing` : "/musteri-paneli#hesap-bagla"));
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
  const state = encodeState({ provider, platform, customerId: targetCompanyId, origin, returnTo, nonce, exp: Date.now() + 10 * 60 * 1000, connectTokenId });
  const codeVerifier = provider === "x" ? crypto.randomBytes(48).toString("base64url") : "";
  const configId = provider === "meta" ? (metaBusinessCredentials()?.configId || "") : "";
  const params = new URLSearchParams(provider === "tiktok" ? {
    // TikTok Login Kit's own param name is client_key, not client_id/app_id
    // — see providerConfig.tiktok's comment for why this differs from the
    // (wrong, previously-configured) Business/Ads API this app used to
    // point at.
    client_key: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: "code",
    scope,
    state
  } : provider === "x" ? {
    client_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: "code",
    state,
    scope,
    code_challenge: pkceChallenge(codeVerifier),
    code_challenge_method: "S256"
  } : configId ? {
    // Reached only when metaBusinessCredentials() returned a fully-set
    // trio — credentials.clientId here is that DEDICATED Business-type
    // app's own client_id (see providerCredentials), never META_APP_ID.
    // For a Facebook Login for Business app, Meta's current documentation
    // states config_id replaces scope entirely ("scope can still be
    // included, [but] we recommend that you do not use it"); permissions/
    // assets are instead defined inside the Configuration itself in the
    // Meta Dashboard.
    client_id: credentials.clientId,
    redirect_uri: credentials.redirectUri,
    response_type: "code",
    state,
    config_id: configId
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
  const response = NextResponse.redirect(`${config.authBase}?${params.toString()}`);
  response.cookies.set(`hk_oauth_state_${provider}`, nonce, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  if (codeVerifier) response.cookies.set(`hk_oauth_pkce_${provider}`, codeVerifier, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });

  await refreshHiddenAccessOnResponse(response, requesterProfileId, request, "oauthConnect");
  return response;
}

async function exchangeCode(provider: Provider, code: string, codeVerifier = "") {
  const credentials = providerCredentials(provider);
  if (provider === "meta") {
    const params = new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, redirect_uri: credentials.redirectUri, code });
    const response = await fetch(`https://graph.facebook.com/v23.0/oauth/access_token?${params.toString()}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || "Meta token alınamadı.");
    const longLivedParams = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      fb_exchange_token: payload.access_token
    });
    const longLivedResponse = await fetch(`https://graph.facebook.com/v23.0/oauth/access_token?${longLivedParams.toString()}`, { cache: "no-store" });
    const longLived = await longLivedResponse.json().catch(() => ({}));
    return {
      accessToken: longLivedResponse.ok && longLived.access_token ? longLived.access_token : payload.access_token,
      expiresIn: longLivedResponse.ok && longLived.expires_in ? longLived.expires_in : payload.expires_in,
      scope: effectiveProviderScope("meta")
    };
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
    // TikTok Login Kit's real token endpoint (open.tiktokapis.com), not
    // the Business/Ads API endpoint this used to point at — see
    // providerConfig.tiktok's comment. Form-urlencoded body, client_key
    // (not app_id), per TikTok's current OAuth token-management docs.
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_key: credentials.clientId, client_secret: credentials.clientSecret, code, grant_type: "authorization_code", redirect_uri: credentials.redirectUri })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error?.message || "TikTok token alınamadı.");
    return { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresIn: payload.expires_in, scope: payload.scope || effectiveProviderScope("tiktok") };
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
  const response = await fetch(`https://graph.facebook.com/v23.0/me?${new URLSearchParams({ fields: "id,name,email", access_token: accessToken }).toString()}`, { cache: "no-store" });
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

async function fetchTikTokUserInfo(accessToken: string) {
  const fields = "open_id,union_id,avatar_url,avatar_large_url,display_name,bio_description,profile_deep_link,is_verified,username,follower_count,following_count,likes_count,video_count";
  const response = await fetch(`https://open.tiktokapis.com/v2/user/info/?fields=${fields}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  const user = payload?.data?.user;
  if (!response.ok || !user?.open_id) throw new Error(payload?.error?.message || "TikTok kullanıcı bilgisi alınamadı.");
  return user as {
    open_id: string; union_id?: string; avatar_url?: string; avatar_large_url?: string; display_name?: string;
    bio_description?: string; profile_deep_link?: string; is_verified?: boolean; username?: string;
    follower_count?: number; following_count?: number; likes_count?: number; video_count?: number;
  };
}

// TikTok Login Kit has no Facebook-Page-style hierarchy: one connected
// account is the one asset. Saved directly (not a two-step parent-then-
// child-selection flow like Meta/Google) — oauthAccounts/selectOAuthAccount
// still work for TikTok too (re-verifying/re-confirming the same single
// account), matching the drawer's existing Yetkili Hesapları Listele /
// Seçilenleri Kaydet buttons, but the connection is already usable right
// after callback.
async function saveTikTokIntegration(session: any, token: any, tiktokUser: Awaited<ReturnType<typeof fetchTikTokUserInfo>>, expiresAt: string) {
  if (!hasSupabaseConfig()) throw new Error("Supabase bağlantısı yapılandırılmadı.");
  const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(session.companyId)}&select=*&limit=1`).catch(() => []);
  const existing = rows[0] || null;
  const currentAssets = Array.isArray(existing?.integration_assets) ? existing.integration_assets : [];
  const now = new Date().toISOString();
  const scopes = String(token.scope || effectiveProviderScope("tiktok")).split(/[,\s]+/).map(clean).filter(Boolean);
  const displayName = tiktokUser.display_name || tiktokUser.username || tiktokUser.open_id;
  const tiktokAsset = {
    id: `tiktok-account-${tiktokUser.open_id}`,
    provider: "tiktok",
    platform: "tiktok",
    platform_label: "TikTok",
    asset_type: "tiktok_account",
    asset_name: displayName,
    asset_id: tiktokUser.open_id,
    account_id: tiktokUser.open_id,
    provider_account_id: tiktokUser.open_id,
    provider_account_name: displayName,
    account_type: "tiktok_account",
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
      username: tiktokUser.username || "",
      avatar_url: tiktokUser.avatar_large_url || tiktokUser.avatar_url || "",
      profile_deep_link: tiktokUser.profile_deep_link || "",
      is_verified: Boolean(tiktokUser.is_verified),
      follower_count: tiktokUser.follower_count ?? null,
      following_count: tiktokUser.following_count ?? null,
      likes_count: tiktokUser.likes_count ?? null,
      video_count: tiktokUser.video_count ?? null
    }
  };
  const nextAssets = [
    tiktokAsset,
    ...currentAssets.filter((item: any) => `${item.provider || item.platform}-${item.account_type || item.asset_type}-${item.provider_account_id || item.account_id || item.asset_id}` !== `tiktok-tiktok_account-${tiktokUser.open_id}`)
  ];
  const sensitiveMetadata = {
    ...(existing?.sensitive_metadata && typeof existing.sensitive_metadata === "object" ? existing.sensitive_metadata : {}),
    tiktok_oauth: {
      access_token_encrypted: encryptSecret(token.accessToken || ""),
      refresh_token_encrypted: token.refreshToken ? encryptSecret(token.refreshToken) : existing?.sensitive_metadata?.tiktok_oauth?.refresh_token_encrypted || "",
      token_expires_at: expiresAt || null,
      scopes,
      updated_at: now
    }
  };
  const patch = {
    company_id: session.companyId,
    customer_id: session.companyId,
    provider: existing?.provider || "tiktok",
    platform: existing?.platform || "tiktok",
    account_type: existing?.account_type || "tiktok_account",
    provider_account_id: existing?.provider_account_id || tiktokUser.open_id,
    provider_account_name: existing?.provider_account_name || displayName,
    status: existing?.status || "connected_oauth",
    source: "customer",
    connection_mode: existing?.connection_mode || "oauth",
    connection_method: existing?.connection_method || "oauth",
    admin_review_status: existing?.admin_review_status || "approved",
    oauth_status: "connected",
    oauth_account_id: existing?.oauth_account_id || tiktokUser.open_id,
    oauth_asset_id: existing?.oauth_asset_id || tiktokUser.open_id,
    oauth_asset_type: existing?.oauth_asset_type || "tiktok_account",
    scopes: Array.from(new Set([...(Array.isArray(existing?.scopes) ? existing.scopes : []), ...scopes])),
    sensitive_metadata: sensitiveMetadata,
    metadata: { ...(existing?.metadata || {}), tiktok_username: tiktokUser.username || "", tiktok_oauth_connected_at: now },
    integration_assets: nextAssets,
    last_synced_at: now,
    sync_error: "",
    updated_by: session.profileId || null,
    created_by: existing?.created_by || session.profileId || null
  };
  await supabaseRest<any[]>("customer_integrations?on_conflict=company_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(patch) });
  return tiktokAsset;
}

function callbackErrorCode(providerError: string, description: string) {
  const text = `${providerError} ${description}`.toLocaleLowerCase("tr-TR");
  if (text.includes("invalid scope") || text.includes("invalid_scopes")) return "invalid_scope";
  if (text.includes("redirect_uri")) return "redirect_uri_mismatch";
  if (text.includes("access_denied") || text.includes("denied")) return "permission_denied";
  return "permission_denied";
}

// Structured, secret-free audit log for oauthCallback — lets a real failed
// attempt in production be diagnosed by timestamp/trace afterward (Vercel
// runtime logs) without needing to reproduce it live. traceId reuses the
// state's own nonce (already a unique per-attempt value tied to a
// short-lived cookie) rather than inventing a second identifier. Never
// pass code/token/secret/cookie values here.
function logOAuthStage(event: string, request: Request, fields: Record<string, string | boolean | null | undefined>) {
  const host = new URL(request.url).host;
  console.log(JSON.stringify({ scope: "oauth_callback", event, host, ...fields }));
}

export async function oauthCallback(provider: Provider, request: Request) {
  const url = new URL(request.url);
  const code = clean(url.searchParams.get("code"));
  const providerError = clean(url.searchParams.get("error"));
  const providerErrorDescription = clean(url.searchParams.get("error_description") || url.searchParams.get("error_message"));
  const rawState = clean(url.searchParams.get("state"));
  const state = decodeState(rawState);
  logOAuthStage("callback_received", request, { provider, path: url.pathname, codePresent: Boolean(code), stateDecoded: Boolean(state), traceId: state?.nonce || null });
  // origin is read from the signed state whenever it decodes (set
  // server-side in oauthConnect above, never from a query param here — a
  // tampered/missing signature already fails decodeState() and state is
  // null). When state does NOT decode — expired, tampered, or simply
  // missing — origin can't be trusted from it, so this falls back to
  // whichever session is *currently* live, purely to pick a safe
  // error-bounce destination. Without this, a broken/expired callback hit
  // by an authenticated HK Admin would default to the customer-panel
  // return route, which itself bounces a non-customer session toward the
  // login screen (src/proxy.ts's staff-preview gate) — reproducing this
  // bug's exact symptom for that one edge case. This inference is never
  // used to authorize a company or complete a handshake — decodeState()
  // failing always still leads to a rejected, no-op state_invalid below.
  const currentSessionForOrigin = state ? null : await getSession();
  const origin: OAuthOrigin =
    state?.origin === "connect_link"
      ? "connect_link"
      : state?.origin === "hk_admin" || (!state && currentSessionForOrigin && isStaffRole(currentSessionForOrigin.role))
        ? "hk_admin"
        : "customer_panel";
  const returnTo = safeReturnTo(state?.returnTo || (origin === "hk_admin" ? "/hk-admin/analiz-raporlama" : origin === "connect_link" ? "/connect/expired" : "/musteri-paneli#hesap-bagla"));

  // Re-verify the *current* session at callback time — never trust the
  // state blob for authorization, only for which company was authorized
  // back in oauthConnect. This is what stops a hijacked/downgraded session
  // (e.g. the admin got logged out mid-flow) from silently completing the
  // handshake, and what keeps customer-panel behavior completely unchanged.
  let sessionCompanyId = "";
  let sessionProfileId: string | null = null;
  if (origin === "hk_admin") {
    const staffSession = await getSession();
    if (!staffSession || !isStaffRole(staffSession.role) || !canAccessModule(staffSession, "analiz-raporlama")) {
      logOAuthStage("admin_session_verified", request, { provider, origin, sessionPresent: Boolean(staffSession), role: staffSession?.role || null, traceId: state?.nonce || null, ok: false });
      return redirectWithIntegrationError(request, returnTo, provider, "session_missing");
    }
    sessionCompanyId = state?.customerId || "";
    sessionProfileId = staffSession.profileId || null;
    logOAuthStage("admin_session_verified", request, { provider, origin, sessionPresent: true, role: staffSession.role, companyId: sessionCompanyId, traceId: state?.nonce || null, ok: true });
  } else if (origin === "connect_link") {
    // No session at all by design — the signed state (only ever created by
    // oauthConnect after validateConnectToken succeeded) is the sole
    // authorization here. Re-checked again below: nonce must match this
    // browser's cookie, and the token is re-validated (not just trusted
    // from the state blob) immediately before it's marked used.
    sessionCompanyId = state?.customerId || "";
    sessionProfileId = null;
    logOAuthStage("admin_session_verified", request, { provider, origin, sessionPresent: false, companyId: sessionCompanyId, traceId: state?.nonce || null, ok: true });
  } else {
    const customerSession = await requireCustomerSession();
    if (!customerSession) {
      logOAuthStage("admin_session_verified", request, { provider, origin, sessionPresent: false, traceId: state?.nonce || null, ok: false });
      return redirectWithIntegrationError(request, returnTo, provider, "session_missing");
    }
    sessionCompanyId = customerSession.companyId;
    sessionProfileId = customerSession.profileId || null;
    logOAuthStage("admin_session_verified", request, { provider, origin, sessionPresent: true, role: customerSession.role, companyId: sessionCompanyId, traceId: state?.nonce || null, ok: true });
  }

  if (missingProviderEnv(provider).length) return redirectWithIntegrationError(request, returnTo, provider, `${provider}_env_missing`);
  const cookieStore = await cookies();
  const expectedNonce = cookieStore.get(`hk_oauth_state_${provider}`)?.value;
  const codeVerifier = cookieStore.get(`hk_oauth_pkce_${provider}`)?.value || "";
  const target = new URL(returnTo, baseUrl(request));
  if (providerError) {
    return redirectWithIntegrationError(request, returnTo, provider, callbackErrorCode(providerError, providerErrorDescription), { oauth_trace: state?.nonce || "" });
  }
  if (!code || !state || state.provider !== provider || state.nonce !== expectedNonce) {
    logOAuthStage("state_verified", request, { provider, origin, traceId: state?.nonce || null, ok: false, reason: !code ? "no_code" : !state ? "no_state" : state.provider !== provider ? "provider_mismatch" : "nonce_mismatch" });
    return redirectWithIntegrationError(request, returnTo, provider, "state_invalid", { oauth_trace: state?.nonce || "" });
  }
  // For a customer-panel handshake the signed company must still match the
  // live session's company (defends against a company switch mid-flow on
  // the same browser). For hk_admin, sessionCompanyId is itself derived
  // from the signed state, so this is inherently satisfied — the company
  // was already authorized in oauthConnect (module access + real company).
  if (origin === "customer_panel" && state.customerId !== sessionCompanyId) {
    logOAuthStage("state_verified", request, { provider, origin, traceId: state.nonce, ok: false, reason: "company_mismatch" });
    return redirectWithIntegrationError(request, returnTo, provider, "state_invalid", { oauth_trace: state.nonce });
  }
  logOAuthStage("state_verified", request, { provider, origin, companyId: sessionCompanyId, traceId: state.nonce, ok: true });
  try {
    logOAuthStage("token_exchange_started", request, { provider, origin, traceId: state.nonce });
    const token = await exchangeCode(provider, code, codeVerifier);
    logOAuthStage("token_exchange_success", request, { provider, origin, traceId: state.nonce });
    const expiresAt = token.expiresIn ? new Date(Date.now() + Number(token.expiresIn) * 1000).toISOString() : "";
    const targetSession = { companyId: sessionCompanyId, profileId: sessionProfileId };
    let metaUser = null;
    if (provider === "meta") {
      try {
        logOAuthStage("integration_persist_started", request, { provider, origin, companyId: sessionCompanyId, traceId: state.nonce });
        metaUser = await fetchMetaUserInfo(token.accessToken);
        await saveMetaPhase1Integration(targetSession, token, metaUser, expiresAt);
        logOAuthStage("integration_persist_success", request, { provider, origin, companyId: sessionCompanyId, traceId: state.nonce });
      } catch (error) {
        console.error("Meta OAuth Phase 1 user info/save failed", error instanceof Error ? error.message : "unknown_error");
        logOAuthStage("integration_persist_success", request, { provider, origin, companyId: sessionCompanyId, traceId: state.nonce, ok: false });
        return redirectWithIntegrationError(request, returnTo, provider, "user_info_fetch_failed", { oauth_trace: state.nonce });
      }
    }
    if (provider === "google") {
      try {
        logOAuthStage("integration_persist_started", request, { provider, origin, companyId: sessionCompanyId, traceId: state.nonce });
        const googleUser = await fetchGoogleUserInfo(token.accessToken);
        await saveGoogleOAuthIntegration(targetSession, token, googleUser, expiresAt);
        logOAuthStage("integration_persist_success", request, { provider, origin, companyId: sessionCompanyId, traceId: state.nonce });
      } catch (error) {
        console.error("Google OAuth user info/save failed", error instanceof Error ? error.message : "unknown_error");
        logOAuthStage("integration_persist_success", request, { provider, origin, companyId: sessionCompanyId, traceId: state.nonce, ok: false });
        return redirectWithIntegrationError(request, returnTo, provider, "user_info_fetch_failed", { oauth_trace: state.nonce });
      }
    }
    if (provider === "tiktok") {
      try {
        logOAuthStage("integration_persist_started", request, { provider, origin, companyId: sessionCompanyId, traceId: state.nonce });
        const tiktokUser = await fetchTikTokUserInfo(token.accessToken);
        await saveTikTokIntegration(targetSession, token, tiktokUser, expiresAt);
        logOAuthStage("integration_persist_success", request, { provider, origin, companyId: sessionCompanyId, traceId: state.nonce });
        // Unlike Meta/Google, TikTok Login Kit authorizes exactly one
        // account with no further "which resource" selection — the saved
        // asset above IS the terminal, real connection, so (only for a
        // connect_link flow) the tiktok capability is genuinely complete
        // right here. Never done for hk_admin/customer_panel origins,
        // which have no connect-link token to update.
        if (origin === "connect_link" && state.connectTokenId) {
          const { markCapabilitiesComplete } = await import("@/lib/connect-links");
          await markCapabilitiesComplete(state.connectTokenId, ["tiktok"]).catch(() => null);
        }
      } catch (error) {
        console.error("TikTok OAuth user info/save failed", error instanceof Error ? error.message : "unknown_error");
        logOAuthStage("integration_persist_success", request, { provider, origin, companyId: sessionCompanyId, traceId: state.nonce, ok: false });
        return redirectWithIntegrationError(request, returnTo, provider, "user_info_fetch_failed", { oauth_trace: state.nonce });
      }
    }
    // Deliberately does NOT mark any capability complete here: parent OAuth
    // alone isn't a finished, canonically-"connected" integration in this
    // app (see getProviderConnectionStatus — it requires a selected child
    // asset in integration_assets). Completion is recorded by
    // connectLinkSelectAccount below, once a real asset is actually saved.
    // The customer is sent back to /connect/<token> to finish that step —
    // parent-only success never marks the link used.
    target.searchParams.set("integration_provider", provider);
    target.searchParams.set("integration_success", provider);
    target.searchParams.set("oauth_status", "accounts_ready");
    target.searchParams.set("oauth_trace", state.nonce);
    if (!target.hash) target.hash = origin === "hk_admin" ? "hesaplar" : "hesap-bagla";
    const response = NextResponse.redirect(target);
    response.cookies.delete(`hk_oauth_state_${provider}`);
    response.cookies.delete(`hk_oauth_pkce_${provider}`);
    response.cookies.set(`hk_oauth_session_${provider}`, encryptSession({ provider, customerId: sessionCompanyId, accessToken: token.accessToken, expiresAt, scope: token.scope, metaUser }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 900, path: "/" });
    // Defense in depth alongside the connect-time refresh above — covers a
    // round trip that outlasted even that freshly-extended window. Runs on
    // the response that's about to carry the browser back into
    // /hk-admin or /musteri-paneli (both behind the same gate), so a fresh
    // grant here is available immediately on the very next request.
    await refreshHiddenAccessOnResponse(response, sessionProfileId, request, "oauthCallback");
    logOAuthStage("final_redirect", request, { provider, origin, companyId: sessionCompanyId, traceId: state.nonce, target: target.pathname, ok: true });
    return response;
  } catch (error) {
    logOAuthStage("token_exchange_success", request, { provider, origin, traceId: state.nonce, ok: false });
    return redirectWithIntegrationError(request, returnTo, provider, "token_exchange_failed", { integration_message: error instanceof Error ? error.message : "OAuth token alınamadı.", oauth_trace: state.nonce });
  }
}

export async function oauthAssets(provider: Provider, request: Request) {
  const session = await requireCustomerSession();
  if (!session) return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });
  const url = new URL(request.url);
  url.searchParams.set("provider", provider);
  return oauthAccounts(new Request(url, { headers: request.headers }));
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

// Returns the RAW error Google itself sent — never a pre-bucketed friendly
// string. classifyGoogleError()/googleDiscoveryGroups() do the bucketing
// downstream, per-service, so each of the 5 provider cards can show its own
// exact diagnostic ("Bu Google hesabında erişilebilir YouTube kanalı
// bulunamadı." vs "YouTube Data API etkin değil." vs "YouTube izni eksik —
// hesabı yeniden bağla.") instead of one blanket "Google API isteği
// başarısız oldu." that looks the same for every failure.
function rawGoogleError(payload: any, fallback: string) {
  return clean(payload?.error?.message || payload?.error_description || payload?.message || (payload?.error && JSON.stringify(payload.error)) || fallback);
}

type GoogleErrorCategory = "developer_token_required" | "api_not_enabled" | "permission_required" | "other";

function classifyGoogleError(raw: string): GoogleErrorCategory {
  const lower = raw.toLocaleLowerCase("tr-TR");
  if (lower.includes("developer token") || lower.includes("developer-token")) return "developer_token_required";
  if (lower.includes("api has not been used") || lower.includes("it is disabled") || lower.includes("not enabled") || lower.includes("has not been used")) return "api_not_enabled";
  if (lower.includes("permission") || lower.includes("insufficient") || lower.includes("forbidden") || lower.includes("unauthorized") || lower.includes("invalid_grant")) return "permission_required";
  return "other";
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
  if (!response.ok) throw new Error(rawGoogleError(payload, "Google API isteği başarısız oldu."));
  return payload;
}

// Google Ads API v25 (current, supported through ~2027 — bumped from v24;
// see the identical version note on analytics-center/providers/google-ads.ts,
// the real metrics-sync adapter, which needed the same bump). Developer
// tokens were sunset by Google on 2026-09-09: access is now determined by
// the Google Cloud project behind GOOGLE_CLIENT_ID/SECRET, not by a
// separate token — the header is "optional and ignored" per Google's own
// migration notice, so it's sent only if still configured (harmless) and
// never required to make the call at all. See docs/analytics-center/setup.md.
const GOOGLE_ADS_API_BASE = "https://googleads.googleapis.com/v25";

function googleAdsHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (process.env.GOOGLE_ADS_DEVELOPER_TOKEN) headers["developer-token"] = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
  return headers;
}

// Best-effort enrichment only — listAccessibleCustomers returns bare
// resource names (IDs), nothing else. One extra GAQL call per discovered
// customer to get a real descriptive_name/manager flag rather than
// fabricating a name; any single customer's failure (no access, MCC quirk)
// never drops that customer from the list or fails the whole discovery —
// it just falls back to an ID-labeled placeholder, same resilience pattern
// used elsewhere in this file (Business Profile locations, per-metric sync).
async function enrichGoogleAdsCustomer(customerId: string, accessToken: string): Promise<{ name: string; isManager: boolean } | null> {
  try {
    const response = await fetch(`${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
      method: "POST",
      headers: { ...googleAdsHeaders(accessToken), "Content-Type": "application/json" },
      body: JSON.stringify({ query: "SELECT customer.id, customer.descriptive_name, customer.manager FROM customer LIMIT 1" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return null;
    const row = Array.isArray(payload.results) ? payload.results[0] : null;
    if (!row?.customer) return null;
    return { name: clean(row.customer.descriptiveName), isManager: Boolean(row.customer.manager) };
  } catch {
    return null;
  }
}

async function fetchGoogleAccounts(accessToken: string) {
  const user = await googleJson("https://www.googleapis.com/oauth2/v3/userinfo", accessToken).catch((error) => ({ sub: "", email: "", name: error instanceof Error ? error.message : "" }));
  const warnings: string[] = [];
  const serviceErrors: Array<{ service: string; category: GoogleErrorCategory; raw: string }> = [];
  function recordFailure(service: string, label: string, reason: unknown) {
    const raw = reason instanceof Error ? reason.message : "Bilinmeyen hata.";
    warnings.push(`${label}: ${raw}`);
    serviceErrors.push({ service, category: classifyGoogleError(raw), raw });
  }
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
  const [ga4, sites, ads, gbpAccounts, youtube] = await Promise.allSettled([
    googleJson("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", accessToken),
    googleJson("https://www.googleapis.com/webmasters/v3/sites", accessToken),
    googleJson(`${GOOGLE_ADS_API_BASE}/customers:listAccessibleCustomers`, accessToken, { headers: googleAdsHeaders(accessToken) }),
    googleJson("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", accessToken),
    googleJson("https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true", accessToken)
  ]);
  if (ga4.status === "fulfilled") {
    const summaries = Array.isArray(ga4.value.accountSummaries) ? ga4.value.accountSummaries : [];
    summaries.flatMap((summary: any) => Array.isArray(summary.propertySummaries) ? summary.propertySummaries : []).forEach((property: any) => {
      accounts.push({ id: `google-ga4-${property.property}`, provider: "google", platform: "google_analytics", category: "GA4 Properties", account_type: "ga4_property", provider_account_id: String(property.property || "").replace("properties/", ""), provider_account_name: property.displayName || property.property, status: "Seçilebilir", metadata: property });
    });
  } else {
    recordFailure("ga4", "GA4", ga4.reason);
  }
  if (sites.status === "fulfilled") {
    const entries = Array.isArray(sites.value.siteEntry) ? sites.value.siteEntry : [];
    entries.forEach((site: any) => accounts.push({ id: `google-search-${site.siteUrl}`, provider: "google", platform: "search_console", category: "Search Console Siteleri", account_type: "search_console_site", provider_account_id: site.siteUrl, provider_account_name: site.siteUrl, status: site.permissionLevel || "Seçilebilir", metadata: site }));
  } else {
    recordFailure("search_console", "Search Console", sites.reason);
  }
  if (ads.status === "fulfilled") {
    const resourceNames: string[] = (Array.isArray(ads.value.resourceNames) ? ads.value.resourceNames : []).slice(0, 25);
    const customerIds = resourceNames.map((resourceName) => clean(resourceName).replace("customers/", ""));
    const enrichments = await Promise.allSettled(customerIds.map((customerId) => enrichGoogleAdsCustomer(customerId, accessToken)));
    customerIds.forEach((customerId, index) => {
      const enriched = enrichments[index].status === "fulfilled" ? (enrichments[index] as PromiseFulfilledResult<{ name: string; isManager: boolean } | null>).value : null;
      accounts.push({
        id: `google-ads-${customerId}`,
        provider: "google",
        platform: "google_ads",
        category: "Google Ads Hesapları",
        account_type: "google_ads_customer",
        provider_account_id: customerId,
        provider_account_name: enriched?.name || `Google Ads Customer ID ${customerId}`,
        status: enriched?.isManager ? "Yönetici hesabı (MCC)" : "Seçilebilir",
        metadata: { resourceName: `customers/${customerId}`, isManager: Boolean(enriched?.isManager) }
      });
    });
  } else {
    recordFailure("google_ads", "Google Ads", ads.reason);
  }
  if (gbpAccounts.status === "fulfilled") {
    const gbpList = Array.isArray(gbpAccounts.value.accounts) ? gbpAccounts.value.accounts : [];
    for (const account of gbpList.slice(0, 10)) {
      const accountName = clean(account.name);
      try {
        const locations = await googleJson(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storeCode,storefrontAddress`, accessToken);
        const locationList = Array.isArray(locations.locations) ? locations.locations : [];
        locationList.forEach((location: any) => {
          const address = location.storefrontAddress ? [location.storefrontAddress.addressLines?.join(", "), location.storefrontAddress.locality].filter(Boolean).join(", ") : "";
          // parentAccount is the RESOURCE name ("accounts/123...", not the
          // human-readable accountName) — analytics-center/providers/
          // google-business.ts's fetchReviewSummary needs exactly this
          // shape to build the reviews API path (`${parentAccount}/${locationId}/reviews`).
          accounts.push({ id: `google-business-location-${location.name}`, provider: "google", platform: "google_business_profile", category: "Business Profile Lokasyonları", account_type: "google_business_location", provider_account_id: location.name, provider_account_name: location.title || location.name, status: "Seçilebilir", metadata: { ...location, parentAccount: accountName, accountLabel: account.accountName || accountName, address } });
        });
        if (!locationList.length) recordFailure("google_business_profile", "Business Profile lokasyonları", new Error(`${account.accountName || accountName}: bu hesapta hiç lokasyon yok.`));
      } catch (error) {
        recordFailure("google_business_profile", "Business Profile lokasyonları", error);
      }
    }
  } else {
    recordFailure("google_business_profile", "Google Business Profile", gbpAccounts.reason);
  }
  if (youtube.status === "fulfilled") {
    const channels = Array.isArray(youtube.value.items) ? youtube.value.items : [];
    channels.forEach((channel: any) => {
      accounts.push({
        id: `google-youtube-${channel.id}`,
        provider: "google",
        platform: "youtube",
        category: "YouTube Kanalları",
        account_type: "youtube_channel",
        provider_account_id: channel.id,
        provider_account_name: channel.snippet?.title || channel.id,
        status: "Seçilebilir",
        metadata: { channelId: channel.id, title: channel.snippet?.title || "", customUrl: channel.snippet?.customUrl || "", thumbnail: channel.snippet?.thumbnails?.default?.url || "", subscriberCount: channel.statistics?.subscriberCount || null }
      });
    });
  } else {
    recordFailure("youtube", "YouTube", youtube.reason);
  }
  (accounts as any).warnings = warnings.filter(Boolean);
  (accounts as any).serviceErrors = serviceErrors;
  return accounts;
}

// Clean, spec-exact, per-service messages — never a single blanket
// "Yetkili hesaplar listelendi." covering all 5 Google services at once
// (the real cause of admins seeing that success text while YouTube/Ads/GBP
// silently had zero rows: the old top-level message only reflected whether
// ANY Google asset of ANY kind was found, not the one service being
// looked at). rawDetail keeps Google's own error text for anyone who needs
// to see exactly what Google said, without putting it in the primary,
// customer/admin-facing message.
const GOOGLE_EMPTY_MESSAGE: Record<string, string> = {
  ga4: "Bu Google hesabında erişilebilir GA4 mülkü bulunamadı.",
  search_console: "Bu Google hesabında erişilebilir Search Console sitesi bulunamadı.",
  google_ads: "Bu Google hesabında erişilebilir Google Ads hesabı bulunamadı.",
  google_business_profile: "Bu Google hesabında erişilebilir Business Profile konumu bulunamadı.",
  youtube: "Bu Google hesabında erişilebilir YouTube kanalı bulunamadı."
};
const GOOGLE_PERMISSION_MESSAGE: Record<string, string> = {
  ga4: "GA4 izni eksik — hesabı yeniden bağla.",
  search_console: "Search Console izni eksik — hesabı yeniden bağla.",
  google_ads: "Google Ads izni eksik — hesabı yeniden bağla.",
  google_business_profile: "Business Profile izni eksik — hesabı yeniden bağla.",
  youtube: "YouTube izni eksik — hesabı yeniden bağla."
};
const GOOGLE_API_NOT_ENABLED_MESSAGE: Record<string, string> = {
  ga4: "Google Analytics Admin API etkin değil.",
  search_console: "Search Console API etkin değil.",
  google_ads: "Google Ads API erişimi etkin değil.",
  google_business_profile: "Google Business Profile API erişimi etkin değil.",
  youtube: "YouTube Data API etkin değil."
};

function googleDiscoveryGroups(accounts: any[], serviceErrors: Array<{ service: string; category: GoogleErrorCategory; raw: string }> = []) {
  const groups: Record<string, { status: string; assets: any[]; message: string; rawDetail?: string }> = {
    ga4: { status: "empty", assets: [], message: GOOGLE_EMPTY_MESSAGE.ga4 },
    search_console: { status: "empty", assets: [], message: GOOGLE_EMPTY_MESSAGE.search_console },
    google_ads: { status: "empty", assets: [], message: GOOGLE_EMPTY_MESSAGE.google_ads },
    google_business_profile: { status: "empty", assets: [], message: GOOGLE_EMPTY_MESSAGE.google_business_profile },
    youtube: { status: "empty", assets: [], message: GOOGLE_EMPTY_MESSAGE.youtube }
  };
  for (const account of accounts) {
    const type = clean(account.account_type || account.asset_type || account.platform);
    // google_business_profile_account (the parent GBP account row, not a
    // syncable/selectable asset) is deliberately excluded — only real
    // locations count as a Business Profile "child asset" here.
    const service = type === "ga4_property" ? "ga4"
      : type === "search_console_site" ? "search_console"
        : type === "google_ads_customer" ? "google_ads"
          : type === "google_business_location" ? "google_business_profile"
            : type.includes("youtube") ? "youtube"
              : "";
    if (!service || !groups[service]) continue;
    groups[service].assets.push(account);
    groups[service].status = "ok";
    groups[service].message = "Varlıklar listelendi.";
  }
  for (const error of serviceErrors) {
    const group = groups[error.service];
    if (!group || group.assets.length) continue; // a real result already exists — a stale warning from elsewhere never overrides it
    group.status = error.category;
    group.rawDetail = error.raw;
    group.message = error.category === "api_not_enabled" ? (GOOGLE_API_NOT_ENABLED_MESSAGE[error.service] || `İlgili Google Cloud API etkin değil: ${error.raw}`)
      : error.category === "permission_required" ? (GOOGLE_PERMISSION_MESSAGE[error.service] || "İzin eksik — hesabı yeniden bağla.")
        : error.raw; // developer_token_required (legacy/rare post-sunset) or "other" — show Google's own text directly
  }
  return groups;
}

// TikTok Login Kit has no page/business-hierarchy — real-time discovery
// always returns exactly the one connected account (there is no equivalent
// of "list the Pages this user manages"), mirroring the single "tiktok
// asset" model saveTikTokIntegration already writes on connect. Kept as a
// real API call (not just echoing the saved row) so oauthAccounts/
// selectOAuthAccount's re-verification-against-a-live-discovery pattern
// stays consistent with Meta/Google — a revoked/expired token surfaces
// here as a real error rather than a stale cached account.
async function fetchTikTokAccounts(accessToken: string) {
  const user = await fetchTikTokUserInfo(accessToken);
  const displayName = user.display_name || user.username || user.open_id;
  return [{
    id: `tiktok-account-${user.open_id}`,
    provider: "tiktok",
    platform: "tiktok",
    account_type: "tiktok_account",
    provider_account_id: user.open_id,
    provider_account_name: displayName,
    status: user.is_verified ? "Doğrulanmış hesap" : "Seçilebilir",
    metadata: {
      username: user.username || "",
      avatar_url: user.avatar_large_url || user.avatar_url || "",
      profile_deep_link: user.profile_deep_link || "",
      is_verified: Boolean(user.is_verified),
      follower_count: user.follower_count ?? null,
      following_count: user.following_count ?? null,
      likes_count: user.likes_count ?? null,
      video_count: user.video_count ?? null
    }
  }];
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

// Shared by oauthAccounts and selectOAuthAccount: resolves which company
// this request is authorized to act on, and a real access token for it —
// preferring the fresh transient hk_oauth_session_{provider} cookie set
// right after a completed handshake (15-minute TTL) when present, and
// otherwise falling back to the token this app ALREADY persists and
// refreshes for exactly this purpose (tokenForCustomerMetaIntegration /
// getGoogleToken — the same helpers analytics-center/tokens.ts uses to fetch
// real metrics). Without this fallback, asset discovery/selection only ever
// worked inside that 15-minute window after connecting — any later revisit
// (e.g. an admin returning to pick a specific Google Ads/GBP asset after the
// initial Phase-1 connect) saw "Hesap listelemek için önce platform
// girişini tamamlayın." even though a fully valid, persisted connection
// already existed.
//
// requestedCompany is only honored for a staff session, and only once
// confirmed to be a real company (companyExistsForStaff) — never trusted
// blindly. A customer session always resolves to their own company,
// ignoring any client-supplied company value.
async function resolveProviderAccessToken(provider: Provider, session: { role?: string | null; companyId?: string | null }, requestedCompany: string) {
  let targetCompanyId = "";
  if (isCustomerRole(session.role) && session.companyId) {
    targetCompanyId = session.companyId;
  } else if (isStaffRole(session.role) && requestedCompany && (await companyExistsForStaff(requestedCompany))) {
    targetCompanyId = requestedCompany;
  }

  const cookieStore = await cookies();
  const oauthSession = decryptSession(cookieStore.get(`hk_oauth_session_${provider}`)?.value);
  let accessToken = "";
  let metaSessionForPhase1 = oauthSession;
  if (oauthSession && oauthSession.provider === provider && (!targetCompanyId || oauthSession.customerId === targetCompanyId)) {
    accessToken = String(oauthSession.accessToken || "");
    if (!targetCompanyId) targetCompanyId = oauthSession.customerId || "";
  } else if (provider === "meta" && targetCompanyId) {
    const stored = await tokenForCustomerMetaIntegration(targetCompanyId);
    accessToken = stored.token;
    metaSessionForPhase1 = { provider, customerId: targetCompanyId, metaUser: stored.integration?.metadata || {} };
  } else if (provider === "google" && targetCompanyId) {
    const stored = await getGoogleToken(targetCompanyId);
    accessToken = stored.token;
  } else if (provider === "tiktok" && targetCompanyId) {
    const stored = await getTikTokToken(targetCompanyId);
    accessToken = stored.token;
  }
  return { accessToken, targetCompanyId, metaSessionForPhase1 };
}

export async function oauthAccounts(request: Request) {
  const session = await requireIntegrationSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekir." }, { status: 403 });
  const url = new URL(request.url);
  const provider = clean(url.searchParams.get("provider")) as Provider;
  if (!["meta", "google", "tiktok", "x"].includes(provider)) return NextResponse.json({ error: "Geçerli platform seçin." }, { status: 400 });
  const missing = missingProviderEnv(provider);
  if (missing.length) return NextResponse.json({ ok: false, provider, accounts: [], code: "oauth_not_configured", missingEnv: missing, message: "Bağlantı yapılandırması eksik." }, { status: 501 });
  const requestedCompany = clean(url.searchParams.get("company") || url.searchParams.get("customerId"));
  const { accessToken, metaSessionForPhase1 } = await resolveProviderAccessToken(provider, session, requestedCompany);
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
    const groups = provider === "google" ? googleDiscoveryGroups(accounts, (accounts as any).serviceErrors || []) : undefined;
    // Never a single blanket "Yetkili hesaplar listelendi." for Google —
    // that text used to cover all 5 services at once, so an admin looking
    // specifically at YouTube/Ads/GBP saw a false "success" message even
    // when that one service returned zero rows. groups[service].message is
    // the real, per-service result; this top-level message is now only a
    // coarse summary for callers that don't look at groups (kept for
    // backward compatibility with any older caller reading .message).
    // Google's own accounts[0] is a non-selectable "profile verified" row,
    // so >1 means at least one real child was found. TikTok/X have no such
    // placeholder — every returned row is itself a real, selectable
    // account — so any result at all (>=1) is success for them.
    const anyChildFound = groups ? Object.values(groups).some((g) => g.assets.length > 0) : provider === "google" ? accounts.length > 1 : accounts.length >= 1;
    return NextResponse.json({
      ok: true,
      provider,
      accounts,
      groups,
      warnings,
      message: anyChildFound ? "Yetkili hesaplar listelendi." : provider === "google" ? "Temel profil doğrulandı; aşağıdaki her servis için ayrı sonucu kontrol edin (bazı hesaplarda hiç varlık bulunamamış veya izin/API eksik olabilir)." : "Yetkili hesap bulunamadı."
    });
  } catch (error) {
    return NextResponse.json({ ok: false, provider, accounts: [], code: "provider_fetch_failed", message: error instanceof Error ? error.message : "Yetkili hesaplar alınamadı." }, { status: 502 });
  }
}

export async function selectOAuthAccount(request: Request) {
  const session = await requireIntegrationSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const inputs = (Array.isArray(body.accounts) && body.accounts.length ? body.accounts : [body]).slice(0, 50);
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
    const providers = new Set(normalizedInputs.map((item: any) => item.provider));
    if (providers.size !== 1) return NextResponse.json({ error: "Farklı sağlayıcılara ait varlıklar tek işlemde kaydedilemez." }, { status: 400 });
    const provider = normalizedInputs[0].provider as Provider;
    if (!["meta", "google", "tiktok", "x"].includes(provider)) return NextResponse.json({ error: "Geçerli platform seçin." }, { status: 400 });

    // Target company: for a customer session, always their own company
    // (unchanged). For a staff session — meta/google/tiktok, the providers
    // Analiz & Raporlama Merkezi drives — an explicit, validated
    // ?company=/body.company, never trusted blindly. Previously this
    // function hard-required isCustomerRole(session.role), so a staff
    // session picking an asset after a successful hk_admin-origin OAuth
    // connect got a 403 here even though requireIntegrationSession() already
    // authorized them.
    const requestedCompany = clean(body.company || body.companyId || body.customerId);
    let targetCompanyId = "";
    if (isCustomerRole(session.role) && session.companyId) {
      targetCompanyId = session.companyId;
    } else if (!isStaffRole(session.role) || (provider !== "meta" && provider !== "google" && provider !== "tiktok")) {
      return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });
    }

    if (provider === "meta" || provider === "google" || provider === "tiktok") {
      // Same resolver oauthAccounts uses: prefers the fresh transient
      // hk_oauth_session_{provider} cookie, falls back to the persisted,
      // auto-refreshing token (tokenForCustomerMetaIntegration/
      // getGoogleToken/getTikTokToken) once that 15-minute window has
      // passed — without this, selecting an asset any time after that
      // window always failed here even though discovery (oauthAccounts,
      // above) already works again via the same fallback.
      const resolved = await resolveProviderAccessToken(provider, session, targetCompanyId || requestedCompany);
      const accessToken = resolved.accessToken;
      if (!targetCompanyId) targetCompanyId = resolved.targetCompanyId;
      if (!targetCompanyId || !accessToken) {
        return NextResponse.json({ error: "Hesap seçimini doğrulamak için platform bağlantısını yeniden tamamlayın." }, { status: 401 });
      }
      const discovered = provider === "meta"
        ? advancedScopesEnabled("meta")
          ? (await listMetaBusinessAssets(accessToken)).accounts
          : [metaPhase1AccountFromSession(resolved.metaSessionForPhase1)].filter(Boolean)
        : provider === "tiktok"
          ? await fetchTikTokAccounts(accessToken)
          : await fetchGoogleAccounts(accessToken);
      const discoveredByKey = new Map(discovered.map((item: any) => [
        `${item.provider}-${item.account_type || item.asset_type}-${item.provider_account_id || item.account_id || item.asset_id}`,
        item
      ]));
      for (const item of normalizedInputs) {
        const key = `${item.provider}-${item.accountType}-${item.providerAccountId}`;
        const verified = discoveredByKey.get(key);
        if (!verified) {
          return NextResponse.json({ error: "Seçilen varlık bu Google/Meta oturumunun yetkili hesapları arasında bulunamadı. Listeyi yenileyip tekrar seçin." }, { status: 403 });
        }
        item.providerAccountName = clean(verified.provider_account_name || verified.asset_name || verified.name || item.providerAccountId);
        item.platform = clean(verified.platform || item.platform);
        item.metadata = verified.metadata && typeof verified.metadata === "object" ? verified.metadata : {};
      }
    }

    const existingRows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(targetCompanyId)}&select=*&limit=1`).catch(() => []);
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
      company_id: targetCompanyId,
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
    return NextResponse.json({ ok: true, integration: publicIntegrationRecord(rows[0]), assets: nextAssets, savedCount: newAssets.length, message: `${newAssets.length} hesap bağlandı ve admin paneline aktarıldı.` });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

// --- HK Connect remote connection link: sessionless asset discovery/save ---
// Narrow, connect-token-authorized counterparts to oauthAccounts/
// selectOAuthAccount above — never bypasses those (both untouched, still
// require requireIntegrationSession()). Reuses the exact same discovery
// (listMetaBusinessAssets/fetchGoogleAccounts/metaPhase1AccountFromSession)
// and the exact same discovery-reverification-before-persist pattern
// selectOAuthAccount uses, so a public caller can never submit an asset id
// that wasn't actually returned by a fresh, real provider call for this
// company's own authorized token. Company is always resolved from the
// validated connect token — never from client input.

export async function connectLinkAccounts(request: Request) {
  const url = new URL(request.url);
  const provider = clean(url.searchParams.get("provider")) as Provider;
  const connectToken = clean(url.searchParams.get("connectToken"));
  if (provider !== "meta" && provider !== "google") return NextResponse.json({ error: "Geçerli platform seçin." }, { status: 400 });

  const { validateConnectToken, META_CAPABILITIES, GOOGLE_CAPABILITIES } = await import("@/lib/connect-links");
  const validated = await validateConnectToken(connectToken);
  if (!validated.valid) return NextResponse.json({ ok: false, error: "TOKEN_INVALID", message: "Bağlantı linki geçersiz veya süresi dolmuş." }, { status: 403 });
  const providerCapabilities = provider === "meta" ? META_CAPABILITIES : GOOGLE_CAPABILITIES;
  if (!providerCapabilities.some((c) => validated.requestedCapabilities.includes(c))) {
    return NextResponse.json({ ok: false, error: "CAPABILITY_NOT_REQUESTED", message: "Bu platform bu bağlantı için istenmemiş." }, { status: 403 });
  }

  const missing = missingProviderEnv(provider);
  if (missing.length) return NextResponse.json({ ok: false, provider, accounts: [], code: "oauth_not_configured", message: "Bağlantı yapılandırması eksik." }, { status: 501 });

  const { accessToken, metaSessionForPhase1 } = await resolveProviderAccessToken(provider, { role: "customer", companyId: validated.companyId }, "");
  if (!accessToken) return NextResponse.json({ ok: false, provider, accounts: [], code: "oauth_session_missing", message: "Önce platform girişini tamamlayın." }, { status: 401 });

  try {
    if (provider === "meta" && !advancedScopesEnabled("meta")) {
      const phase1Account = metaPhase1AccountFromSession(metaSessionForPhase1);
      return NextResponse.json({ ok: true, provider, accounts: phase1Account ? [phase1Account] : [], phase: "meta_oauth_phase_1" });
    }
    if (provider === "meta") {
      const result = await listMetaBusinessAssets(accessToken);
      return NextResponse.json({ ok: true, provider, accounts: result.accounts, groups: result.groups, message: result.message });
    }
    const accounts = await fetchGoogleAccounts(accessToken);
    const groups = googleDiscoveryGroups(accounts, (accounts as any).serviceErrors || []);
    return NextResponse.json({ ok: true, provider, accounts, groups });
  } catch (error) {
    return NextResponse.json({ ok: false, provider, accounts: [], code: "provider_fetch_failed", message: error instanceof Error ? error.message : "Yetkili hesaplar alınamadı." }, { status: 502 });
  }
}

export async function connectLinkSelectAccount(request: Request) {
  const body = await request.json().catch(() => ({}));
  const connectToken = clean(body.connectToken);
  const { validateConnectToken, markCapabilitiesComplete, META_CAPABILITIES, GOOGLE_CAPABILITIES, ASSET_TYPE_TO_CAPABILITY } = await import("@/lib/connect-links");
  const validated = await validateConnectToken(connectToken);
  if (!validated.valid) return NextResponse.json({ error: "Bağlantı linki geçersiz veya süresi dolmuş." }, { status: 403 });

  const inputs = (Array.isArray(body.accounts) && body.accounts.length ? body.accounts : [body]).slice(0, 50);
  const normalizedInputs = inputs.map((item: any) => ({
    provider: clean(item.provider || body.provider),
    platform: clean(item.platform || body.platform || item.provider || body.provider),
    providerAccountId: clean(item.provider_account_id || item.account_id || item.asset_id),
    providerAccountName: clean(item.provider_account_name || item.asset_name || item.name),
    accountType: clean(item.account_type || item.asset_type || item.platform || body.account_type || body.asset_type),
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {}
  })).filter((item: any) => item.provider && item.platform && item.providerAccountId);
  if (!normalizedInputs.length) return NextResponse.json({ error: "Kaydetmek için en az bir geçerli hesap seçin." }, { status: 400 });

  const providers = new Set(normalizedInputs.map((item: any) => item.provider));
  if (providers.size !== 1) return NextResponse.json({ error: "Farklı sağlayıcılara ait varlıklar tek işlemde kaydedilemez." }, { status: 400 });
  const provider = normalizedInputs[0].provider as Provider;
  if (provider !== "meta" && provider !== "google") return NextResponse.json({ error: "Geçerli platform seçin." }, { status: 400 });
  const providerCapabilities = provider === "meta" ? META_CAPABILITIES : GOOGLE_CAPABILITIES;
  if (!providerCapabilities.some((c) => validated.requestedCapabilities.includes(c))) {
    return NextResponse.json({ error: "Bu platform bu bağlantı için istenmemiş." }, { status: 403 });
  }

  const targetCompanyId = validated.companyId;
  try {
    const resolved = await resolveProviderAccessToken(provider, { role: "customer", companyId: targetCompanyId }, "");
    const accessToken = resolved.accessToken;
    if (!accessToken) return NextResponse.json({ error: "Hesap seçimini doğrulamak için platform bağlantısını yeniden tamamlayın." }, { status: 401 });

    // Re-verify every submitted asset against a FRESH real discovery call —
    // a public client can never persist an id that wasn't actually
    // returned for this company's own authorized provider session.
    const discovered = provider === "meta"
      ? advancedScopesEnabled("meta") ? (await listMetaBusinessAssets(accessToken)).accounts : [metaPhase1AccountFromSession(resolved.metaSessionForPhase1)].filter(Boolean)
      : await fetchGoogleAccounts(accessToken);
    const discoveredByKey = new Map(discovered.map((item: any) => [`${item.provider}-${item.account_type || item.asset_type}-${item.provider_account_id || item.account_id || item.asset_id}`, item]));
    for (const item of normalizedInputs) {
      const key = `${item.provider}-${item.accountType}-${item.providerAccountId}`;
      const verified = discoveredByKey.get(key);
      if (!verified) return NextResponse.json({ error: "Seçilen varlık bu oturumun yetkili hesapları arasında bulunamadı. Listeyi yenileyip tekrar seçin." }, { status: 403 });
      item.providerAccountName = clean(verified.provider_account_name || verified.asset_name || verified.name || item.providerAccountId);
      item.platform = clean(verified.platform || item.platform);
      item.metadata = verified.metadata && typeof verified.metadata === "object" ? verified.metadata : {};
    }

    const existingRows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(targetCompanyId)}&select=*&limit=1`).catch(() => []);
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
      source: "connect_link",
      connection_mode: "oauth",
      connection_method: "oauth",
      admin_review_status: "approved",
      oauth_status: "connected",
      last_synced_at: now,
      metadata: item.metadata
    }));
    const newKeys = new Set(newAssets.map((item: any) => `${item.provider}-${item.account_type}-${item.provider_account_id}`));
    const nextAssets = [...newAssets, ...currentAssets.filter((item: any) => !newKeys.has(`${item.provider || item.platform}-${item.account_type || item.asset_type}-${item.provider_account_id || item.account_id || item.asset_id}`))];
    const primary = newAssets[0];
    const patch = {
      company_id: targetCompanyId,
      provider: primary.provider,
      provider_account_id: primary.provider_account_id,
      provider_account_name: primary.provider_account_name,
      account_type: primary.account_type,
      status: "connected_oauth",
      source: "connect_link",
      connection_mode: "oauth",
      connection_method: "oauth",
      admin_review_status: "approved",
      oauth_status: "connected",
      oauth_account_id: primary.provider_account_id,
      oauth_asset_id: primary.provider_account_id,
      oauth_asset_type: primary.account_type,
      metadata: primary.metadata || {},
      integration_assets: nextAssets,
      last_synced_at: now,
      updated_by: null,
      created_by: existing?.created_by || null
    };
    await supabaseRest("customer_integrations?on_conflict=company_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(patch) });

    // Only the capabilities whose asset type was ACTUALLY selected and
    // verified above are marked complete — never the whole provider's
    // requested capability set. Selecting just a GA4 property must never
    // silently mark google_ads/search_console "done" too (the false-
    // success bug this fixes: the public /connect page would show full
    // success while HK Connect still correctly reported Google Ads as
    // disconnected).
    const completedCapabilities = Array.from(new Set(
      newAssets.map((item: any) => ASSET_TYPE_TO_CAPABILITY[item.account_type]).filter(Boolean)
    )) as import("@/lib/connect-links").ConnectCapability[];
    if (completedCapabilities.length) await markCapabilitiesComplete(validated.id, completedCapabilities);
    return NextResponse.json({ ok: true, savedCount: newAssets.length, completedCapabilities, message: `${newAssets.length} hesap bağlandı.` });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

// Removes one connected asset (a Page, a channel, an Ads account, or the
// shared parent login row itself) from integration_assets. Same
// customer-vs-staff trust boundary as selectOAuthAccount: a customer
// session may only ever act on its own company; a staff session may only
// act on an explicit, validated ?company=/body.company. Never revokes the
// token at the provider itself (Meta/Google have no such single-call API
// for an OAuth app; the user themselves can do that from their own account
// settings) — this only stops HK Dijital from treating the asset as
// connected and clears it from admin/customer views.
export async function disconnectIntegrationAsset(request: Request) {
  const session = await requireIntegrationSession();
  if (!session) return NextResponse.json({ error: "Oturum gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const provider = clean(body.provider) as Provider;
  const accountType = clean(body.account_type || body.accountType || body.asset_type || body.assetType);
  const providerAccountId = clean(body.provider_account_id || body.providerAccountId || body.account_id || body.asset_id);
  if (!provider || !accountType || !providerAccountId) {
    return NextResponse.json({ error: "Bağlantısı kesilecek hesap bilgisi eksik." }, { status: 400 });
  }

  const requestedCompany = clean(body.company || body.companyId || body.customerId);
  let targetCompanyId = "";
  if (isCustomerRole(session.role) && session.companyId) {
    targetCompanyId = session.companyId;
  } else if (isStaffRole(session.role) && requestedCompany && (await companyExistsForStaff(requestedCompany))) {
    targetCompanyId = requestedCompany;
  }
  if (!targetCompanyId) return NextResponse.json({ error: "Müşteri oturumu gerekir." }, { status: 403 });

  try {
    const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(targetCompanyId)}&select=*&limit=1`).catch(() => []);
    const existing = rows[0] || null;
    if (!existing) return NextResponse.json({ ok: true, assets: [], message: "Zaten bağlı bir hesap yok." });
    const currentAssets: any[] = Array.isArray(existing.integration_assets) ? existing.integration_assets : [];
    const targetKey = `${provider}-${accountType}-${providerAccountId}`;
    const keyOf = (item: any) => `${item.provider || item.platform}-${item.account_type || item.asset_type}-${item.provider_account_id || item.account_id || item.asset_id}`;
    const removed = currentAssets.some((item) => keyOf(item) === targetKey);
    const nextAssets = currentAssets.filter((item) => keyOf(item) !== targetKey);
    const patch: Record<string, unknown> = { integration_assets: nextAssets, updated_by: session.profileId || null };
    // Disconnecting the row's own top-level pointer (e.g. the shared Meta/
    // Google parent login itself) — clear that pointer too so status reads
    // stop showing a connected account that no longer exists.
    if (existing.account_type === accountType && existing.provider_account_id === providerAccountId) {
      patch.status = "reauth_required";
      patch.oauth_status = "disconnected";
      patch.provider_account_id = null;
      patch.provider_account_name = null;
    }
    await supabaseRest(`customer_integrations?company_id=eq.${encodeURIComponent(targetCompanyId)}`, { method: "PATCH", body: JSON.stringify(patch) });
    return NextResponse.json({ ok: true, assets: nextAssets, message: removed ? "Bağlantı kesildi." : "Hesap zaten bağlı değildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

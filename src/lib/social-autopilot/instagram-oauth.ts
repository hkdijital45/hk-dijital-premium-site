// Admin-session-scoped Instagram OAuth connect/callback + token lifecycle.
// Deliberately separate from src/lib/customer-integration-oauth.ts: that
// module connects a *customer's* ad account (customer session, per-customer
// row). This connects HK Dijital's own Instagram account once, at the
// workspace level — same signed-state CSRF pattern (HMAC over
// OAUTH_STATE_SECRET with the same production-fail-closed behavior) and the
// same token-at-rest encryption (secret-storage.ts) as the rest of the app,
// reused rather than reinvented.
import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest } from "@/lib/supabase";
import { encryptSecret, decryptSecret } from "@/lib/secret-storage";
import { safeCompare } from "@/lib/secure-compare";
import {
  INSTAGRAM_SCOPES, buildInstagramAuthorizeUrl, exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken, refreshLongLivedToken, fetchInstagramProfile, instagramAppCredentials
} from "./instagram-graph-client";
import { SOCIAL_WORKSPACE_ID, type SocialIntegration } from "./types";

const CALLBACK_PATH = "/api/admin/social-autopilot/instagram/callback";

function firstEnv(keys: string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return "";
}

function stateSecret() {
  const configured = firstEnv(["OAUTH_STATE_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_SESSION_SECRET"]);
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Instagram OAuth state imzalamak için gerekli secret env değişkenlerinden hiçbiri üretimde tanımlı değil.");
  }
  return "hk-dijital-local-social-autopilot-state";
}

function sign(value: string) {
  return createHmac("sha256", stateSecret()).update(value).digest("base64url");
}

type SignedState = { nonce: string; profileId: string; exp: number };

function encodeState(state: SignedState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeState(raw: string): SignedState | null {
  const [payload, signature] = (raw || "").split(".");
  if (!payload || !signature) return null;
  let expected: string;
  try { expected = sign(payload); } catch { return null; }
  if (!safeCompare(expected, signature)) return null;
  try {
    const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SignedState;
    if (!state.exp || state.exp < Date.now()) return null;
    return state;
  } catch {
    return null;
  }
}

function redirectUriFor(request: Request) {
  const url = new URL(request.url);
  const configured = process.env.INSTAGRAM_OAUTH_REDIRECT_URI;
  return configured || `${url.protocol}//${url.host}${CALLBACK_PATH}`;
}

async function getIntegrationRow(): Promise<SocialIntegration | null> {
  const rows = await supabaseRest<SocialIntegration[]>(`social_integrations?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
  return rows[0] || null;
}

async function upsertIntegration(patch: Partial<SocialIntegration>) {
  const existing = await getIntegrationRow();
  if (existing) {
    const rows = await supabaseRest<SocialIntegration[]>(`social_integrations?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*`, {
      method: "PATCH", body: JSON.stringify(patch)
    });
    return rows[0];
  }
  const rows = await supabaseRest<SocialIntegration[]>("social_integrations", {
    method: "POST", body: JSON.stringify({ workspace_id: SOCIAL_WORKSPACE_ID, ...patch })
  });
  return rows[0];
}

export async function startInstagramOAuth(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const { configured } = instagramAppCredentials();
  if (!configured) {
    return NextResponse.json({
      error: "INSTAGRAM_APP_ID ve INSTAGRAM_APP_SECRET yapılandırılmadı.",
      missingEnv: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"]
    }, { status: 501 });
  }

  const state = encodeState({ nonce: randomUUID(), profileId: session.profileId || "", exp: Date.now() + 10 * 60 * 1000 });
  const authorizeUrl = buildInstagramAuthorizeUrl(redirectUriFor(request), state);
  return NextResponse.redirect(authorizeUrl);
}

export async function handleInstagramOAuthCallback(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  const url = new URL(request.url);
  const adminBase = `${url.protocol}//${url.host}/hk-admin/social-autopilot`;

  if (!session) return NextResponse.redirect(`${adminBase}?instagram_error=unauthorized`);

  const providerError = url.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(`${adminBase}?instagram_error=${encodeURIComponent(providerError)}`);
  }

  const stateRaw = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const state = decodeState(stateRaw);
  if (!state || !code) return NextResponse.redirect(`${adminBase}?instagram_error=invalid_state`);
  if (state.profileId && session.profileId && state.profileId !== session.profileId) {
    return NextResponse.redirect(`${adminBase}?instagram_error=session_mismatch`);
  }

  try {
    const shortLived = await exchangeCodeForShortLivedToken(code, redirectUriFor(request));
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    // shortLived.user_id is deliberately NOT used as a graph.instagram.com
    // node id (see instagram-graph-client.ts's header comment) — /me on the
    // long-lived token is the only reliable source for the real, reusable
    // Instagram professional account id.
    const profile = await fetchInstagramProfile(longLived.access_token);

    await upsertIntegration({
      provider: "instagram",
      ig_user_id: profile.user_id,
      username: profile.username,
      account_type: profile.account_type,
      access_token_encrypted: encryptSecret(longLived.access_token),
      token_expires_at: new Date(Date.now() + longLived.expires_in * 1000).toISOString(),
      scopes: [...INSTAGRAM_SCOPES],
      status: "connected",
      connected_at: new Date().toISOString(),
      connected_by: session.profileId || null,
      last_successful_call_at: new Date().toISOString(),
      last_error: null
    });

    return NextResponse.redirect(`${adminBase}?instagram=connected`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await upsertIntegration({ status: "error", last_error: message.slice(0, 500) }).catch(() => {});
    return NextResponse.redirect(`${adminBase}?instagram_error=${encodeURIComponent("connect_failed")}`);
  }
}

export async function disconnectInstagram() {
  await upsertIntegration({
    status: "disconnected", access_token_encrypted: null, token_expires_at: null,
    ig_user_id: null, username: null, account_type: null, scopes: []
  });
}

export type InstagramConnectionStatus = {
  status: SocialIntegration["status"];
  username: string | null;
  accountType: string | null;
  scopes: string[];
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  tokenHealth: "healthy" | "warning" | "expired" | "not_connected";
  lastSuccessfulCallAt: string | null;
  lastPublishAt: string | null;
  lastInsightsSyncAt: string | null;
  lastError: string | null;
  appConfigured: boolean;
};

export async function getInstagramConnectionStatus(): Promise<InstagramConnectionStatus> {
  const row = await getIntegrationRow();
  const { configured } = instagramAppCredentials();
  const expiresAt = row?.token_expires_at ? new Date(row.token_expires_at) : null;
  const daysUntilExpiry = expiresAt ? (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24) : null;

  let tokenHealth: InstagramConnectionStatus["tokenHealth"] = "not_connected";
  if (row?.status === "connected") {
    if (daysUntilExpiry === null) tokenHealth = "healthy";
    else if (daysUntilExpiry <= 0) tokenHealth = "expired";
    else if (daysUntilExpiry <= 7) tokenHealth = "warning";
    else tokenHealth = "healthy";
  }

  return {
    status: row?.status || "disconnected",
    username: row?.username || null,
    accountType: row?.account_type || null,
    scopes: row?.scopes || [],
    connectedAt: row?.connected_at || null,
    tokenExpiresAt: row?.token_expires_at || null,
    tokenHealth,
    lastSuccessfulCallAt: row?.last_successful_call_at || null,
    lastPublishAt: row?.last_publish_at || null,
    lastInsightsSyncAt: row?.last_insights_sync_at || null,
    lastError: row?.last_error || null,
    appConfigured: configured
  };
}

export class InstagramNotConnectedError extends Error {
  constructor(message = "Instagram bağlı değil.") { super(message); this.name = "InstagramNotConnectedError"; }
}

/** Returns a usable access token + ig_user_id, transparently refreshing the
 * long-lived token when it's within 10 days of expiry (Meta requires the
 * token be at least 24h old before it can be refreshed; 10 days gives ample
 * margin without refreshing on every call). Marks the integration
 * token_expired on refresh failure rather than silently retrying forever. */
export async function getUsableInstagramToken(): Promise<{ accessToken: string; igUserId: string }> {
  const row = await getIntegrationRow();
  if (!row || row.status === "disconnected" || !row.access_token_encrypted || !row.ig_user_id) {
    throw new InstagramNotConnectedError();
  }
  if (row.status === "token_expired") throw new InstagramNotConnectedError("Instagram token'ı süresi dolmuş — yeniden bağlanması gerekiyor.");

  let accessToken = decryptSecret(row.access_token_encrypted);
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  const daysUntilExpiry = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysUntilExpiry <= 10) {
    try {
      const refreshed = await refreshLongLivedToken(accessToken);
      accessToken = refreshed.access_token;
      await upsertIntegration({
        access_token_encrypted: encryptSecret(refreshed.access_token),
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        status: "connected",
        last_successful_call_at: new Date().toISOString()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Token yenileme başarısız oldu";
      await upsertIntegration({ status: "token_expired", last_error: message.slice(0, 500) }).catch(() => {});
      throw new InstagramNotConnectedError(message);
    }
  }

  return { accessToken, igUserId: row.ig_user_id };
}

export async function recordInstagramSuccess(patch: Partial<Pick<SocialIntegration, "last_publish_at" | "last_insights_sync_at" | "last_successful_call_at">>) {
  await upsertIntegration({ ...patch, last_successful_call_at: new Date().toISOString(), status: "connected", last_error: null });
}

export async function recordInstagramError(message: string) {
  await upsertIntegration({ last_error: message.slice(0, 500) });
}

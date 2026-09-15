import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/business-flow";
import { supabaseRest } from "@/lib/supabase";
import { tokenForCustomerMetaIntegration } from "@/lib/meta-business-phase2";
import { getCustomerIntegrationRecord } from "./connections";
import type { AnalyticsProvider } from "./types";

export type TokenResult = { token: string; message: string };

// Meta (instagram/facebook) — reuses the exact decrypt path already proven
// by the Meta Ads insight flow, so token storage/refresh stays governed by
// one function instead of drifting between two.
export async function getMetaToken(companyId: string): Promise<TokenResult> {
  const { token, message } = await tokenForCustomerMetaIntegration(companyId);
  return { token, message };
}

// Google (youtube/google_ads/google_business_profile) — customer_integrations
// stores Google OAuth under sensitive_metadata.google_oauth (see
// customer-integration-oauth.ts's oauthCallback), distinct from Meta's
// top-level access_token_encrypted column. Refreshes automatically when
// expired, using the standard OAuth refresh_token grant, and persists the
// new access token back so the next sync doesn't need to refresh again.
export async function getGoogleToken(companyId: string): Promise<TokenResult> {
  const row = await getCustomerIntegrationRecord(companyId);
  const googleOAuth = row?.sensitive_metadata?.google_oauth;
  if (!googleOAuth?.access_token_encrypted) {
    return { token: "", message: "Google ile giriş yapılmamış. Müşteri panelinden (Hesap Bağla) Google bağlantısı tamamlanmalı." };
  }

  const expiresAt = googleOAuth.token_expires_at ? new Date(googleOAuth.token_expires_at).getTime() : 0;
  const stillValid = expiresAt && expiresAt > Date.now() + 60_000; // 60s safety margin
  if (stillValid) {
    try {
      return { token: decryptSecret(googleOAuth.access_token_encrypted), message: "Token hazır." };
    } catch {
      return { token: "", message: "Google token çözülemedi. Yeniden bağlantı gerekebilir." };
    }
  }

  const refreshToken = googleOAuth.refresh_token_encrypted ? decryptSecret(googleOAuth.refresh_token_encrypted) : "";
  if (!refreshToken) {
    return { token: "", message: "Google oturumu süresi dolmuş ve yenileme jetonu yok. Müşteri panelinden Google ile yeniden bağlanmalı." };
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) {
    return { token: "", message: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET sunucu ortam değişkenleri tanımlanmadan Google token yenilenemez." };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      return { token: "", message: payload.error_description || payload.error || "Google token yenilenemedi. Müşteri panelinden yeniden bağlanmalı." };
    }
    const newExpiresAt = new Date(Date.now() + Number(payload.expires_in || 3600) * 1000).toISOString();
    const nextGoogleOAuth = {
      ...googleOAuth,
      access_token_encrypted: encryptSecret(String(payload.access_token)),
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString()
    };
    await supabaseRest(`customer_integrations?company_id=eq.${encodeURIComponent(companyId)}`, {
      method: "PATCH",
      body: JSON.stringify({ sensitive_metadata: { ...row.sensitive_metadata, google_oauth: nextGoogleOAuth }, updated_at: new Date().toISOString() })
    }).catch(() => null);
    return { token: String(payload.access_token), message: "Token yenilendi." };
  } catch (error) {
    return { token: "", message: error instanceof Error ? error.message : "Google token yenileme isteği başarısız oldu." };
  }
}

export async function getProviderToken(companyId: string, provider: AnalyticsProvider): Promise<TokenResult> {
  if (provider === "instagram" || provider === "facebook") return getMetaToken(companyId);
  return getGoogleToken(companyId);
}

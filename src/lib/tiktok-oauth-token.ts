import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/business-flow";
import { supabaseRest } from "@/lib/supabase";

// Standalone (no dependency on analytics-center/* or customer-integration-oauth.ts)
// for the same reason as google-oauth-token.ts: avoids a circular import
// between customer-integration-oauth.ts and any analytics-center module
// that needs to read a customer's persisted TikTok token.

export type TikTokTokenResult = { token: string; message: string };

async function getIntegrationRow(companyId: string) {
  const rows = await supabaseRest<any[]>(`customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`).catch(() => []);
  return rows[0] || null;
}

// customer_integrations stores TikTok OAuth under
// sensitive_metadata.tiktok_oauth (see customer-integration-oauth.ts's
// oauthCallback/saveTikTokIntegration), the same pattern already used for
// Google. TikTok access tokens are valid 24h, refresh tokens 365 days (per
// TikTok's current Login Kit token-management docs) — refreshed
// automatically here and persisted back so the next call doesn't need to
// refresh again.
export async function getTikTokToken(companyId: string): Promise<TikTokTokenResult> {
  const row = await getIntegrationRow(companyId);
  const tiktokOAuth = row?.sensitive_metadata?.tiktok_oauth;
  if (!tiktokOAuth?.access_token_encrypted) {
    return { token: "", message: "TikTok ile giriş yapılmamış. Bağlantı yönetiminden TikTok bağlantısı tamamlanmalı." };
  }

  const expiresAt = tiktokOAuth.token_expires_at ? new Date(tiktokOAuth.token_expires_at).getTime() : 0;
  const stillValid = expiresAt && expiresAt > Date.now() + 60_000; // 60s safety margin
  if (stillValid) {
    try {
      return { token: decryptSecret(tiktokOAuth.access_token_encrypted), message: "Token hazır." };
    } catch {
      return { token: "", message: "TikTok token çözülemedi. Yeniden bağlantı gerekebilir." };
    }
  }

  const refreshToken = tiktokOAuth.refresh_token_encrypted ? decryptSecret(tiktokOAuth.refresh_token_encrypted) : "";
  if (!refreshToken) {
    return { token: "", message: "TikTok oturumu süresi dolmuş ve yenileme jetonu yok. TikTok ile yeniden bağlanılmalı." };
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY || "";
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || "";
  if (!clientKey || !clientSecret) {
    return { token: "", message: "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET sunucu ortam değişkenleri tanımlanmadan TikTok token yenilenemez." };
  }

  try {
    const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: refreshToken })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      return { token: "", message: payload.error_description || payload.error?.message || "TikTok token yenilenemedi. Yeniden bağlanılmalı." };
    }
    const newExpiresAt = new Date(Date.now() + Number(payload.expires_in || 86400) * 1000).toISOString();
    const nextTikTokOAuth = {
      ...tiktokOAuth,
      access_token_encrypted: encryptSecret(String(payload.access_token)),
      refresh_token_encrypted: payload.refresh_token ? encryptSecret(String(payload.refresh_token)) : tiktokOAuth.refresh_token_encrypted,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString()
    };
    await supabaseRest(`customer_integrations?company_id=eq.${encodeURIComponent(companyId)}`, {
      method: "PATCH",
      body: JSON.stringify({ sensitive_metadata: { ...row.sensitive_metadata, tiktok_oauth: nextTikTokOAuth }, updated_at: new Date().toISOString() })
    }).catch(() => null);
    return { token: String(payload.access_token), message: "Token yenilendi." };
  } catch {
    return { token: "", message: "TikTok token yenileme isteği başarısız oldu." };
  }
}

import "server-only";
import { tokenForCustomerMetaIntegration } from "@/lib/meta-business-phase2";
import { getGoogleToken as sharedGetGoogleToken } from "@/lib/google-oauth-token";
import { getTikTokToken as sharedGetTikTokToken } from "@/lib/tiktok-oauth-token";
import type { AnalyticsProvider } from "./types";

export type TokenResult = { token: string; message: string };

// Meta (instagram/facebook) — reuses the exact decrypt path already proven
// by the Meta Ads insight flow, so token storage/refresh stays governed by
// one function instead of drifting between two.
export async function getMetaToken(companyId: string): Promise<TokenResult> {
  const { token, message } = await tokenForCustomerMetaIntegration(companyId);
  return { token, message };
}

// Google (youtube/google_ads/google_business_profile) — moved to
// src/lib/google-oauth-token.ts so customer-integration-oauth.ts's OAuth
// asset discovery/selection endpoints can share the exact same persisted-
// token/refresh logic without a circular import (this module's own
// connections.ts import chain leads back into customer-integration-oauth.ts).
export const getGoogleToken = sharedGetGoogleToken;

// TikTok — same pattern, own module (src/lib/tiktok-oauth-token.ts) for the
// same circular-import reason as Google's.
export const getTikTokToken = sharedGetTikTokToken;

export async function getProviderToken(companyId: string, provider: AnalyticsProvider): Promise<TokenResult> {
  if (provider === "instagram" || provider === "facebook") return getMetaToken(companyId);
  if (provider === "tiktok") return getTikTokToken(companyId);
  return getGoogleToken(companyId);
}

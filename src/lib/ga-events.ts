import { hasAnalyticsConsent, hasMarketingConsent } from "./tracking-consent.ts";
declare global {
  interface Window {
    dataLayer?: unknown[];
    hkGaMode?: "gtm" | "direct";
    gtag?: (...args: unknown[]) => void;
  }
}
export function pushGaEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !hasAnalyticsConsent() || !window.hkGaMode) return;
  if (window.hkGaMode === "direct") window.gtag?.("event", name, params || {});
  else {
    window.dataLayer = window.dataLayer || [];
    // Clear the previous parameter object so GTM v2 variables cannot inherit it.
    window.dataLayer.push({ event_params: null });
    window.dataLayer.push({ event: name, event_params: params || {} });
  }
}

// Google Ads "Potansiyel müşteri formu gönderimi" conversion
// (AW-17670817544/cldVCND5xd4bEIiOjepB) — verified real IDs, not
// admin-configurable like analyticsIds (gaMeasurement/metaPixel), so kept
// as a named constant here rather than another DB-editable field. Fired
// from EXACTLY ONE place (trackEvent()'s "form_submitted" branch in
// TrackingPlaceholders.tsx — the same already-success-gated dispatch
// point ContactForm.tsx/QuoteWizard.tsx call after a real, confirmed API
// success, never on open/step/validation-error/retry), so this can never
// double-fire per real submission. No `value`/`currency` is sent: the
// Google Ads interface's own configured conversion value (reported as
// "1000") could not be verified as a genuine business figure from this
// repository — that decision belongs in the Google Ads UI, not a
// fabricated number here (see the final audit report).
export const GOOGLE_ADS_LEAD_CONVERSION_SEND_TO = "AW-17670817544/cldVCND5xd4bEIiOjepB";

// Google tag "connected site tags" setup (confirmed via GA4 Admin > Data
// Streams > manual install instructions, and via direct HTTP checks on
// 2026-10-21): the GA4 destination G-WN98CMWEZF and the Google Ads
// destination AW-17670817544 are BOTH connected under one primary Google
// tag, G-SMGL6PEYJ1 — only the primary tag's own ID is servable at
// https://www.googletagmanager.com/gtag/js?id=... (verified HTTP 200);
// loading the script with a connected destination's own ID 404s (verified
// HTTP 404 for G-WN98CMWEZF), which is why no events were reaching GA4 at
// all. The destination ID itself does NOT change — gtag('config', ...)
// is still called with G-WN98CMWEZF exactly as before; only the <script>
// src must use this primary loader ID.
export const GOOGLE_TAG_LOADER_ID = "G-SMGL6PEYJ1";

export function fireGoogleAdsConversion(sendTo: string) {
  if (typeof window === "undefined" || !hasMarketingConsent() || window.hkGaMode !== "direct" || typeof window.gtag !== "function") return;
  window.gtag("event", "conversion", { send_to: sendTo });
}

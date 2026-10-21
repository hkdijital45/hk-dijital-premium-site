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

// The GA4 measurement ID stored in admin-configurable site_settings
// (G-WN98CMWEZF) was initially assumed to be a "connected site tag"
// destination under this ID, since G-SMGL6PEYJ1 alone served gtag.js
// successfully. Direct re-verification on 2026-10-21 disproved that:
// G-WN98CMWEZF 404s not only as a script loader but ALSO as a destination
// config fetch (`gtag/js?id=G-WN98CMWEZF&cx=c`) — the exact request
// Google Tag Assistant reported failing — meaning Google's servers do not
// recognize this ID in ANY capacity (it is stale/deleted/never valid).
// G-SMGL6PEYJ1 and AW-17670817544 both succeed in every capacity tested.
// G-SMGL6PEYJ1 is therefore the only verified-real, currently live GA4
// measurement ID (also the one GA4's own "manual install" instructions
// recommend for this property) and is used for BOTH the script loader
// and the gtag('config', ...) destination — not merely the loader.
export const GOOGLE_TAG_LOADER_ID = "G-SMGL6PEYJ1";

export function fireGoogleAdsConversion(sendTo: string) {
  if (typeof window === "undefined" || !hasMarketingConsent() || window.hkGaMode !== "direct" || typeof window.gtag !== "function") return;
  window.gtag("event", "conversion", { send_to: sendTo });
}

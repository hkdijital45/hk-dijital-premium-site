import { hasAnalyticsConsent } from "./tracking-consent.ts";
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

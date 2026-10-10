// Thin, shared dataLayer push — consumed by both GA4-direct (gtag.js) and
// Google Tag Manager, since gtag.js itself is just a dataLayer wrapper and
// GTM listens on the same array. No dependency on which one is actually
// loaded (TrackingPlaceholders.tsx decides that from the admin-configured
// ids) — a push here is a no-op until a real container/tag is listening,
// never a duplicate script load.
declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function pushGaEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...params });
}

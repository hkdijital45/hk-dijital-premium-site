export type TrackingConsent = { analytics: boolean; marketing: boolean };
export const CONSENT_KEY = "hk_tracking_consent_v1";
export const CONSENT_EVENT = "hk_consent_change";
let memoryConsent: TrackingConsent | null = null;
export function readConsent(): TrackingConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = JSON.parse(window.localStorage.getItem(CONSENT_KEY) || "null");
    if (stored && stored.expires > Date.now() && typeof stored.analytics === "boolean" && typeof stored.marketing === "boolean") return stored;
  } catch { /* Storage can be unavailable. */ }
  return memoryConsent;
}
export function hasAnalyticsConsent() { return readConsent()?.analytics === true; }
export function hasMarketingConsent() { return readConsent()?.marketing === true; }
export function consentSnapshot() {
  const consent = readConsent();
  return consent ? `${Number(consent.analytics)}${Number(consent.marketing)}` : "unset";
}
export function subscribeConsent(callback: () => void) {
  window.addEventListener(CONSENT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(CONSENT_EVENT, callback); window.removeEventListener("storage", callback); };
}
export function writeConsent(consent: TrackingConsent) {
  const previous = readConsent();
  memoryConsent = consent;
  try { window.localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...consent, expires: Date.now() + 180 * 86400000 })); } catch { /* Keep this visit's choice in memory. */ }
  window.gtag?.("consent", "update", { analytics_storage: consent.analytics ? "granted" : "denied", ad_storage: consent.marketing ? "granted" : "denied", ad_user_data: consent.marketing ? "granted" : "denied", ad_personalization: consent.marketing ? "granted" : "denied" });
  if (!consent.marketing) window.fbq?.("consent", "revoke");
  window.dispatchEvent(new Event(CONSENT_EVENT));
  // Stop already-loaded third-party listeners when consent is withdrawn.
  if ((previous?.analytics && !consent.analytics) || (previous?.marketing && !consent.marketing)) {
    const names = document.cookie.split(";").map(cookie => cookie.trim().split("=")[0]);
    const domains = ["", window.location.hostname, `.${window.location.hostname}`, ".hkdijital.com.tr"];
    for (const name of names) {
      if ((!consent.analytics && /^_ga(?:_|$)/.test(name)) || (!consent.marketing && /^(_fbp|_fbc|_gcl_)/.test(name))) {
        for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ` domain=${domain};` : ""} SameSite=Lax; Secure`;
      }
    }
    if (!consent.analytics) { try { window.sessionStorage.removeItem("hk_analytics_sid"); } catch {} }
    window.location.reload();
  }
}

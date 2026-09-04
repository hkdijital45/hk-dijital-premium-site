"use client";

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: (...args: unknown[]) => void;
  }
}

export type MetaPixelPayload = Record<string, string | number | boolean | null | undefined>;

// Shared with FirstPartyAnalytics.tsx so admin/customer-portal/auth
// navigations never count toward public-site traffic metrics.
export const PRIVATE_PATH_PREFIXES = [
  "/hk-admin",
  "/musteri-paneli",
  "/api",
  "/digital-center",
  "/giris",
  "/login",
  "/musteri-merkezi",
  "/hk-control",
  "/kurulum",
  "/super-admin-kurulum",
  "/sifre-sifirla"
];

export function isPublicTrackedPath(pathname: string) {
  return !PRIVATE_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function hasMetaPixel() {
  return Boolean(META_PIXEL_ID);
}

export function trackMetaEvent(eventName: string, payload?: MetaPixelPayload) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", eventName, payload || {});
}

export function trackMetaCustomEvent(eventName: string, payload?: MetaPixelPayload) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("trackCustom", eventName, payload || {});
}

export function trackMetaPageView(path?: string) {
  trackMetaEvent("PageView", path ? { page_path: path } : undefined);
}

export function trackMetaContact(payload?: MetaPixelPayload) {
  trackMetaEvent("Contact", payload);
}

export function trackMetaLead(payload?: MetaPixelPayload) {
  trackMetaEvent("Lead", payload);
}

export function trackMetaCtaClick(label: string, href?: string) {
  const lowerHref = String(href || "").toLocaleLowerCase("tr");
  const payload = { cta_label: label, cta_href: href || "" };
  trackMetaCustomEvent("HK_CTA_Click", payload);

  if (lowerHref.includes("wa.me") || lowerHref.includes("whatsapp")) {
    trackMetaContact(payload);
    return;
  }
  if (lowerHref.includes("teklif") || lowerHref.includes("paket")) {
    trackMetaEvent("InitiateCheckout", payload);
    return;
  }
  if (lowerHref.includes("iletisim")) {
    trackMetaContact(payload);
    return;
  }
  if (lowerHref.includes("demo") || lowerHref.includes("digital-center")) {
    trackMetaEvent("ViewContent", payload);
  }
}

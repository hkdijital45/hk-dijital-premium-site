// Plain (non-"use client") utility, deliberately kept out of
// MarketingVisualSystem.tsx: that file is "use client", so anything it
// exports — including plain helper functions — becomes a client reference
// that Server Components cannot call directly (only render as JSX). Server
// pages like /hizmetler need to call this mapping function inline in their
// render body, so it has to live in a server-safe module.
export type ServiceVisualVariant = "googleAds" | "metaAds" | "socialMedia" | "consultancy";

export function serviceVisualVariantForKey(key: string): ServiceVisualVariant {
  if (key === "googleAds" || key === "google-ads") return "googleAds";
  if (key === "metaAds" || key === "meta-ads") return "metaAds";
  if (key === "socialMedia" || key === "social-strategy") return "socialMedia";
  return "consultancy";
}

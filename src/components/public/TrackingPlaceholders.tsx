"use client";

type Props = {
  ids: {
    metaPixel: string;
    googleTagManager: string;
    gaMeasurement: string;
  };
};

export function trackEvent(name: string, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("hk_tracking_event", { detail: { name, payload } }));
  // Integrate Meta Pixel, GA4 and GTM events here when real IDs are configured.
}

export function TrackingPlaceholders({ ids }: Props) {
  // Add real Meta Pixel, Google Tag Manager and GA4 script injection here.
  // IDs are admin-managed and intentionally not hardcoded.
  if (!ids.metaPixel && !ids.googleTagManager && !ids.gaMeasurement) return null;
  return null;
}

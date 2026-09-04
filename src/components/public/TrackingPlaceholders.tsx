"use client";

import { trackMetaContact, trackMetaCtaClick, trackMetaCustomEvent, trackMetaEvent, trackMetaLead } from "@/lib/meta-pixel";
import { postAnalyticsEvent } from "@/lib/analytics-client";

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

  // First-party mirror of the classification below — kept in the same
  // function so the two never drift apart. Only real, already
  // success-gated call sites reach here (see ContactForm.tsx/QuoteWizard.tsx),
  // so a Lead event here always means a lead was actually saved, never a
  // button press alone.
  if (name.includes("whatsapp")) postAnalyticsEvent("Contact");
  else if (name.includes("form_submitted")) postAnalyticsEvent("Lead");
  else if (name.includes("wizard_started")) postAnalyticsEvent("InitiateCheckout");
  else if (name.includes("package") || name.includes("cta") || name.includes("social_link")) postAnalyticsEvent("HK_CTA_Click");

  if (name.includes("whatsapp")) {
    trackMetaContact({ source: name, ...(payload as Record<string, string | number | boolean | null | undefined> | undefined) });
    return;
  }
  if (name.includes("form_submitted")) {
    trackMetaLead({ source: name, ...(payload as Record<string, string | number | boolean | null | undefined> | undefined) });
    return;
  }
  if (name.includes("package") || name.includes("cta")) {
    if (name.includes("package")) {
      trackMetaEvent("InitiateCheckout", { source: name, ...(payload as Record<string, string | number | boolean | null | undefined> | undefined) });
    }
    trackMetaCtaClick(name, typeof payload?.href === "string" ? payload.href : undefined);
    return;
  }
  trackMetaCustomEvent(`HK_${name}`, payload as Record<string, string | number | boolean | null | undefined> | undefined);
}

export function TrackingPlaceholders({ ids }: Props) {
  // Add real Meta Pixel, Google Tag Manager and GA4 script injection here.
  // IDs are admin-managed and intentionally not hardcoded.
  if (!ids.metaPixel && !ids.googleTagManager && !ids.gaMeasurement) return null;
  return null;
}

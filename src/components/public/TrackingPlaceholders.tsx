"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { isPublicTrackedPath, trackMetaContact, trackMetaCtaClick, trackMetaCustomEvent, trackMetaEvent, trackMetaLead } from "@/lib/meta-pixel";
import { postAnalyticsEvent } from "@/lib/analytics-client";
import { pushGaEvent, fireGoogleAdsConversion, GOOGLE_ADS_LEAD_CONVERSION_SEND_TO, GOOGLE_TAG_LOADER_ID } from "@/lib/ga-events";
import { consentSnapshot, subscribeConsent } from "@/lib/tracking-consent";

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

  // GA4/GTM mirror, mapped onto GA4-recommended event names. No PII is
  // ever in `payload` at any real call site (form_name/step/value/service
  // id/package id/href only — never name/email/phone/message body).
  const gaParams = { ...(payload as Record<string, unknown> | undefined) };
  const currentPath = typeof window !== "undefined" ? window.location.pathname : undefined;
  if (name.includes("whatsapp")) {
    pushGaEvent("whatsapp_click", { button_location: name, link_type: "wa.me", destination_platform: "whatsapp", page_path: currentPath, ...gaParams });
  } else if (name.includes("form_submitted")) {
    // Only reached after a real successful API response (see call sites) —
    // this is GA4's recommended "generate_lead" event, never fired on a
    // mere button press.
    pushGaEvent("generate_lead", { form_name: gaParams.form_name, ...gaParams });
    // Google Ads "Potansiyel müşteri formu gönderimi" conversion — fired
    // from this ONE already-success-gated branch only, so it can never
    // double-count a single real submission or fire on a validation
    // error/retry/open/step-advance (see ga-events.ts for the full
    // reasoning and why no value/currency is attached).
    fireGoogleAdsConversion(GOOGLE_ADS_LEAD_CONVERSION_SEND_TO);
  } else if (name.includes("wizard_started")) {
    // Only this one — QuoteWizard also fires a "pre_analysis_started"
    // event in the same breath as a distinct custom signal (unmapped,
    // falls through to the generic branch below); mapping both to
    // "form_start" would double-count a single wizard start in GA4.
    pushGaEvent("form_start", { form_name: gaParams.form_name || "Dijital Pazarlama Ön Analizi", ...gaParams });
  } else if (name.includes("package")) {
    pushGaEvent("package_click", gaParams);
    pushGaEvent("select_content", { content_type: "package", ...gaParams });
  } else if (name.includes("service")) {
    pushGaEvent("service_click", gaParams);
    pushGaEvent("select_content", { content_type: "service", ...gaParams });
  } else if (name.includes("social_link")) {
    // Dedicated, clearly-named event (distinct from GA4's own built-in
    // automatic outbound-click "click" event) so a real social profile
    // visit is never confused with GA4's generic click measurement —
    // select_content below is kept too, for dashboards already built on it.
    pushGaEvent("social_outbound_click", { platform: gaParams.platform, page_path: currentPath, link_location: name, ...gaParams });
    pushGaEvent("select_content", { content_type: "cta", cta_location: name, ...gaParams });
  } else if (name.includes("cta")) {
    pushGaEvent("select_content", { content_type: "cta", cta_location: name, ...gaParams });
  } else {
    // Step-progress and other custom milestones (quote_step_completed,
    // pre_analysis_completed, ...) — kept as their own event name rather
    // than forced into one of GA4's recommended names, since none fits.
    pushGaEvent(name, gaParams);
  }

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
    trackMetaCtaClick(name, typeof payload?.href === "string" ? payload.href : undefined, false);
    return;
  }
  trackMetaCustomEvent(`HK_${name}`, payload as Record<string, string | number | boolean | null | undefined> | undefined);
}

// Basic consent mode: no Google script is requested before analytics consent.
export function TrackingPlaceholders({ ids }: Props) {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, consentSnapshot, () => "unset");
  const lastPath = useRef<string | null>(null);
  const previousPage = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || !isPublicTrackedPath(pathname) || !consent.startsWith("1")) return;
    const gtm = /^GTM-[A-Z0-9]+$/.test(ids.googleTagManager) ? ids.googleTagManager : "";
    const ga = /^G-[A-Z0-9]+$/.test(ids.gaMeasurement) ? ids.gaMeasurement : "";
    if (!gtm && !ga) return;
    window.dataLayer = window.dataLayer || [];
    // gtag requires an Arguments object, not a plain array.
    // eslint-disable-next-line prefer-rest-params
    window.gtag = window.gtag || function () { window.dataLayer!.push(arguments); };
    if (!window.hkGaMode) {
      window.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    }
    window.gtag("consent", "update", { analytics_storage: "granted", ad_storage: consent === "11" ? "granted" : "denied", ad_user_data: consent === "11" ? "granted" : "denied", ad_personalization: consent === "11" ? "granted" : "denied" });
    if (!window.hkGaMode) {
      window.hkGaMode = gtm ? "gtm" : "direct";
      const script = document.createElement("script");
      script.async = true;
      script.id = "hk-google-loader";
      if (gtm) {
        window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
        script.src = `https://www.googletagmanager.com/gtm.js?id=${gtm}`;
      } else {
        window.gtag("js", new Date());
        // `ga` (the admin-configured site_settings value) only gates
        // whether direct GA4 mode is enabled at all — the destination it
        // actually configures is GOOGLE_TAG_LOADER_ID, the only ID
        // verified live on Google's servers in every capacity (script
        // load AND destination-config fetch). See its doc comment in
        // ga-events.ts for the full verification trail.
        window.gtag("config", GOOGLE_TAG_LOADER_ID, { send_page_view: false });
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_LOADER_ID}`;
      }
      document.head.appendChild(script);
    }
    // Query strings may contain form values or access tokens. Public route
    // identity and referrers deliberately exclude query strings and hashes.
    const location = window.location.origin + pathname;
    if (lastPath.current !== pathname) {
      let referrer = previousPage.current || "";
      if (!referrer && document.referrer) { try { const u = new URL(document.referrer); referrer = u.origin + u.pathname; } catch {} }
      pushGaEvent("page_view", { page_path: pathname, page_location: location, page_referrer: referrer, page_title: document.title });
      previousPage.current = location;
      lastPath.current = pathname;
    }
  }, [pathname, consent, ids.googleTagManager, ids.gaMeasurement]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("nav a") : null;
      if (!(link instanceof HTMLAnchorElement) || !isPublicTrackedPath(window.location.pathname)) return;
      pushGaEvent("navigation_click", { link_text: link.textContent?.trim().slice(0, 100), link_url: link.origin + link.pathname + link.hash, navigation_location: "header", page_path: window.location.pathname });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

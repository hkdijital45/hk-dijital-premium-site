"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isPublicTrackedPath, trackMetaContact, trackMetaCtaClick, trackMetaCustomEvent, trackMetaEvent, trackMetaLead } from "@/lib/meta-pixel";
import { postAnalyticsEvent } from "@/lib/analytics-client";
import { pushGaEvent } from "@/lib/ga-events";

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
  if (name.includes("whatsapp")) {
    pushGaEvent("whatsapp_click", { cta_location: name, ...gaParams });
  } else if (name.includes("form_submitted")) {
    // Only reached after a real successful API response (see call sites) —
    // this is GA4's recommended "generate_lead" event, never fired on a
    // mere button press.
    pushGaEvent("generate_lead", { form_name: gaParams.form_name, ...gaParams });
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
  } else if (name.includes("cta") || name.includes("social_link")) {
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
    trackMetaCtaClick(name, typeof payload?.href === "string" ? payload.href : undefined);
    return;
  }
  trackMetaCustomEvent(`HK_${name}`, payload as Record<string, string | number | boolean | null | undefined> | undefined);
}

// Fires exactly one GA4 "page_view" per route — on first mount AND on every
// client-side navigation (Next.js App Router doesn't trigger a full reload,
// so gtag's own automatic pageview never fires again after the first one;
// this effect is the single source of truth instead, which is why gtag is
// configured below with `send_page_view: false`). The `lastPath` ref is the
// de-dupe guard against React re-running the effect without the pathname
// actually changing (e.g. a parent re-render) — without it a page could be
// double-counted.
function usePageViewTracking(enabled: boolean) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !pathname) return;
    if (!isPublicTrackedPath(pathname)) return;
    const query = typeof window !== "undefined" ? window.location.search : "";
    const fullPath = query ? `${pathname}${query}` : pathname;
    if (lastPath.current === fullPath) return;
    lastPath.current = fullPath;
    pushGaEvent("page_view", { page_path: fullPath, page_location: typeof window !== "undefined" ? window.location.href : undefined });
  }, [enabled, pathname]);
}

export function TrackingPlaceholders({ ids }: Props) {
  const hasGtm = Boolean(ids.googleTagManager);
  const hasGa4 = Boolean(ids.gaMeasurement);
  usePageViewTracking(hasGtm || hasGa4);

  if (!ids.metaPixel && !hasGtm && !hasGa4) return null;

  return (
    <>
      {hasGtm && (
        <>
          <Script id="gtm-init" strategy="afterInteractive">
            {`
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
              var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
              j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${ids.googleTagManager}');
            `}
          </Script>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${ids.googleTagManager}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        </>
      )}
      {/* Direct gtag.js only when no GTM container is configured — never
          both at once, which would double-count page views/events. */}
      {!hasGtm && hasGa4 && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ids.gaMeasurement}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ids.gaMeasurement}', { send_page_view: false });
            `}
          </Script>
        </>
      )}
    </>
  );
}

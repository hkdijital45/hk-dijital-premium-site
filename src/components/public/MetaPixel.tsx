"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { isPublicTrackedPath, META_PIXEL_ID, trackMetaPageView } from "@/lib/meta-pixel";

import { consentSnapshot, subscribeConsent } from "@/lib/tracking-consent";

export function MetaPixel({ pixelId = META_PIXEL_ID }: { pixelId?: string }) {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, consentSnapshot, () => "unset");
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!/^\d+$/.test(pixelId) || consent !== "11" || !pathname || !isPublicTrackedPath(pathname)) return;
    if (!window.fbq) {
      const queue: unknown[][] = [];
      const fbq = Object.assign(function (...args: unknown[]) {
        if (fbq.callMethod) fbq.callMethod(...args); else queue.push(args);
      }, { queue, loaded: true, version: "2.0", callMethod: undefined as undefined | ((...args: unknown[]) => void), push: undefined as undefined | ((...args: unknown[]) => void) });
      fbq.push = fbq;
      window.fbq = fbq;
      window._fbq = fbq;
      window.fbq("init", pixelId);
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    if (lastPath.current !== pathname) { trackMetaPageView(pathname); lastPath.current = pathname; }
  }, [pathname, pixelId, consent]);
  // REMOVED (duplicate-fire bug, found during the Phase 8 Meta Pixel
  // audit): this used to be a second, document-level capturing listener
  // that fired its own trackMetaContact("whatsapp_link") for ANY <a> whose
  // href matched a WhatsApp pattern — on top of the explicit
  // trackMetaCtaClick(...)/trackEvent("whatsapp...") every real WhatsApp
  // CTA already fires on its own onClick (ContactDock, Header,
  // HomepageExperience, QuoteWizard, and now /iletisim's — see
  // TrackedCtaLink.tsx). Every real WhatsApp link site-wide was therefore
  // reporting Meta's "Contact" event TWICE per actual click. No coverage
  // is lost by removing it: every known WhatsApp link is now explicitly
  // instrumented at its own click handler instead of via this blanket,
  // double-counting fallback.
  return null;
}

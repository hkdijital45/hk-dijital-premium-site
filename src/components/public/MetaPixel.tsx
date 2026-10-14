"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { isPublicTrackedPath, META_PIXEL_ID, trackMetaContact, trackMetaPageView } from "@/lib/meta-pixel";

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
  useEffect(() => {
    if (!pixelId || consent !== "11") return;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      const href = target?.getAttribute("href") || "";
      if (/wa\.me|api\.whatsapp|whatsapp/i.test(href)) trackMetaContact({ source: "whatsapp_link", link_url: href });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pixelId, consent]);
  return null;
}

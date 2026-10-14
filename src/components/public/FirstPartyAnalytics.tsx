"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { isPublicTrackedPath } from "@/lib/meta-pixel";
import { postAnalyticsEvent } from "@/lib/analytics-client";

import { consentSnapshot, subscribeConsent } from "@/lib/tracking-consent";

// Always mounted, independent of any third-party pixel/GA configuration —
// the admin "Web Site Analitiği" screen's own numbers must not depend on
// whether a Meta Pixel or GA4 measurement ID happens to be set.
export function FirstPartyAnalytics() {
  const pathname = usePathname();
  const consent = useSyncExternalStore(subscribeConsent, consentSnapshot, () => "unset");
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || !isPublicTrackedPath(pathname) || !consent.startsWith("1") || lastPath.current === pathname) return;
    lastPath.current = pathname;
    postAnalyticsEvent("PageView", pathname);
  }, [pathname, consent]);

  return null;
}

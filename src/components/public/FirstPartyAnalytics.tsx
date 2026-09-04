"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isPublicTrackedPath } from "@/lib/meta-pixel";
import { postAnalyticsEvent } from "@/lib/analytics-client";

// Always mounted, independent of any third-party pixel/GA configuration —
// the admin "Web Site Analitiği" screen's own numbers must not depend on
// whether a Meta Pixel or GA4 measurement ID happens to be set.
export function FirstPartyAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !isPublicTrackedPath(pathname)) return;
    postAnalyticsEvent("PageView", pathname);
  }, [pathname]);

  return null;
}

"use client";

// Shared browser-side helper for posting first-party events to
// /api/analytics/track. Failures here must never affect the page — no
// personal data is collected, only a per-tab random session id used to
// group counts for the admin dashboard.

export type FirstPartyEventName = "PageView" | "Contact" | "Lead" | "InitiateCheckout" | "ViewContent" | "HK_CTA_Click";

function getSessionId() {
  if (typeof window === "undefined") return "";
  try {
    const key = "hk_analytics_sid";
    let sid = window.sessionStorage.getItem(key);
    if (!sid) {
      sid = crypto.randomUUID();
      window.sessionStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

function referrerSource(): "Direct" | "Organic" | "Facebook / Instagram" | "Google" | "Referral" {
  if (typeof document === "undefined" || !document.referrer) return "Direct";
  try {
    const referrerUrl = new URL(document.referrer);
    if (typeof window !== "undefined" && referrerUrl.hostname === window.location.hostname) return "Direct";
    const host = referrerUrl.hostname.replace(/^www\./, "");
    if (/(^|\.)google\./.test(host)) return "Google";
    if (/(^|\.)(facebook|instagram|fb)\./.test(host)) return "Facebook / Instagram";
    if (/(^|\.)(bing|yahoo|duckduckgo|yandex)\./.test(host)) return "Organic";
    return "Referral";
  } catch {
    return "Direct";
  }
}

export function postAnalyticsEvent(eventName: FirstPartyEventName, pagePath?: string) {
  if (typeof window === "undefined") return;
  const sessionId = getSessionId();
  if (!sessionId) return;
  const body = JSON.stringify({
    event_name: eventName,
    page_path: pagePath || window.location.pathname,
    session_id: sessionId,
    source: referrerSource()
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/track", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/analytics/track", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Analytics must never break the page.
  }
}

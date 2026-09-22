// Legitimate, server-side signal detection for a discovered business's own
// public website: a normal HTTPS GET of a publicly served page (the same
// request any browser makes), read once, checked for well-known Meta Pixel
// and Google tag script markers. This is NOT the Meta Ad Library or Google
// Ads Transparency Center — it cannot prove a campaign is running, only
// whether a tracking snippet is installed. See evaluateAdvertisingSignals()
// in lead-scoring.ts for why that distinction matters and is never blurred.

export type WebsiteSignalScanResult = {
  metaPixelDetected: boolean | null;
  googleTagDetected: boolean | null;
  whatsappLinkDetected: boolean | null;
  instagramProfile: { username: string; url: string } | null;
  scanFailed: boolean;
  checkedAt: string;
};

const META_PIXEL_MARKERS = ["connect.facebook.net", "fbq(", "fbevents.js", "facebook-jssdk"];
const GOOGLE_TAG_MARKERS = ["googletagmanager.com/gtag/js", "googletagmanager.com/gtm.js", "google_tag_manager", "gtag(", "www.googleadservices.com"];
const WHATSAPP_MARKERS = ["wa.me/", "api.whatsapp.com", "whatsapp://send"];
// Non-profile Instagram paths — a link to one of these is not a business
// profile handle and must never be reported as a matched Instagram account.
const INSTAGRAM_NON_PROFILE_PATHS = new Set(["p", "reel", "reels", "explore", "accounts", "share", "stories", "tv", "about", "legal", "developer", "web", "direct", "embed"]);

/** A business linking to its OWN Instagram from its OWN public website is
 * about the highest-confidence, lowest-risk signal available — no
 * Instagram API call, no scraping of Instagram itself, just reading a
 * marker already present in the same HTML this function already fetches
 * for Pixel/Tag detection. */
export function extractInstagramProfile(html: string): { username: string; url: string } | null {
  const pattern = /instagram\.com\/([a-z0-9._]{2,30})/gi;
  for (const match of html.matchAll(pattern)) {
    const candidate = match[1].toLocaleLowerCase("en-US").replace(/\.+$/, "");
    if (!candidate || INSTAGRAM_NON_PROFILE_PATHS.has(candidate)) continue;
    return { username: candidate, url: `https://www.instagram.com/${candidate}/` };
  }
  return null;
}

function normalizeUrl(website: string) {
  const trimmed = website.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function scanWebsiteForAdSignals(website?: string | null, timeoutMs = 6000): Promise<WebsiteSignalScanResult> {
  const checkedAt = new Date().toISOString();
  const url = website ? normalizeUrl(website) : null;
  if (!url) {
    return { metaPixelDetected: null, googleTagDetected: null, whatsappLinkDetected: null, instagramProfile: null, scanFailed: false, checkedAt };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HKDijitalDiscoveryBot/1.0)" }
    });
    if (!response.ok) {
      return { metaPixelDetected: null, googleTagDetected: null, whatsappLinkDetected: null, instagramProfile: null, scanFailed: true, checkedAt };
    }
    const html = (await response.text()).toLocaleLowerCase("en-US").slice(0, 500_000);
    return {
      metaPixelDetected: META_PIXEL_MARKERS.some((marker) => html.includes(marker)),
      googleTagDetected: GOOGLE_TAG_MARKERS.some((marker) => html.includes(marker)),
      whatsappLinkDetected: WHATSAPP_MARKERS.some((marker) => html.includes(marker)),
      instagramProfile: extractInstagramProfile(html),
      scanFailed: false,
      checkedAt
    };
  } catch {
    return { metaPixelDetected: null, googleTagDetected: null, whatsappLinkDetected: null, instagramProfile: null, scanFailed: true, checkedAt };
  } finally {
    clearTimeout(timeout);
  }
}

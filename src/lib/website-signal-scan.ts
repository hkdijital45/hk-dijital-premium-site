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
// Includes Meta's shared static-resource path names (rsrc.php is the same
// resource-loader naming Meta uses across facebook.com/instagram.com) in
// addition to the known non-profile route segments.
const INSTAGRAM_NON_PROFILE_PATHS = new Set([
  "p", "reel", "reels", "explore", "accounts", "share", "stories", "tv", "about", "legal",
  "developer", "web", "direct", "embed", "static", "resource", "resources", "internal",
  "auth", "login", "logout", "api", "graphql", "ajax", "oauth", "privacy", "terms",
  "robots.txt", "favicon.ico", "rsrc.php", "sitemap.xml", "manifest.json"
]);
// Any path segment that LOOKS like a static asset filename (has a known
// resource file extension) is rejected regardless of whether it's on the
// explicit exclusion list above — this is the general-case defense (an
// exclusion list alone can never enumerate every internal Meta resource
// path; a real Instagram username never carries a file extension).
const RESOURCE_FILE_EXTENSION_PATTERN = /\.(php|jsx?|tsx?|css|s?css|png|jpe?g|gif|svg|webp|json|xml|ico|woff2?|ttf|map|txt)$/i;

/** A business linking to its OWN Instagram from its OWN public website is
 * about the highest-confidence, lowest-risk signal available — no
 * Instagram API call, no scraping of Instagram itself, just reading a
 * marker already present in the same HTML this function already fetches
 * for Pixel/Tag detection. */
export function extractInstagramProfile(html: string): { username: string; url: string } | null {
  // Captures the FULL path segment (including hyphens/slashes-adjacent
  // chars a real username never has) so the extension/shape checks below
  // see the whole filename — a truncated capture that stops at the first
  // disallowed character (e.g. "some" out of "some-bundle-name.png")
  // could otherwise slip through looking like a short, plausible handle.
  const pattern = /instagram\.com\/([a-z0-9._-]{2,60})/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = match[1];
    if (RESOURCE_FILE_EXTENSION_PATTERN.test(raw)) continue;
    // Real Instagram usernames never contain a hyphen or a consecutive/
    // leading period — a candidate shaped like that is a URL path
    // fragment, not a handle.
    if (raw.includes("-")) continue;
    const candidate = raw.toLocaleLowerCase("en-US").replace(/\.+$/, "");
    if (!candidate || candidate.length < 2 || candidate.length > 30 || candidate.startsWith(".") || candidate.includes("..")) continue;
    if (INSTAGRAM_NON_PROFILE_PATHS.has(candidate)) continue;
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

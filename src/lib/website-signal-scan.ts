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

// Non-profile Instagram path segments — a link to one of these is not a
// business profile handle. Kept as a secondary/defense-in-depth filter
// only; the primary defense below is POSITIVE validation (a real
// Instagram username shape), not this exclusion list, because a
// blacklist can never enumerate every internal Meta path (this is
// exactly how "_n", "rsrc.php" etc. previously slipped through).
const INSTAGRAM_NON_PROFILE_PATHS = new Set([
  "p", "reel", "reels", "explore", "accounts", "share", "stories", "tv", "about", "legal",
  "developer", "web", "direct", "embed", "static", "resource", "resources", "internal",
  "auth", "login", "logout", "api", "graphql", "ajax", "oauth", "privacy", "terms",
  "robots.txt", "favicon.ico", "rsrc.php", "sitemap.xml", "manifest.json"
]);

// A real Instagram username: 3-30 chars (Instagram technically allows down
// to 1, but genuine business handles are essentially never 1-2 chars —
// that range is almost exclusively internal/tracking fragments like "_n",
// "ig", "l" seen in the wild), must START and END with a letter or digit
// (Instagram itself forbids a leading/trailing period, and requiring an
// alnum boundary additionally excludes underscore-prefixed internal
// identifiers without excluding any real business handle we've observed),
// letters/digits/underscore/period allowed in the middle, no consecutive
// periods.
const INSTAGRAM_USERNAME_PATTERN = /^[a-z0-9](?:(?!\.\.)[a-z0-9._]){1,28}[a-z0-9]$/;
// A static-resource filename (embed.js, style.css, ...) is structurally
// indistinguishable from a valid username by character class alone (both
// allow letters/digits/periods) — reject anything ending in a known
// resource extension regardless of otherwise matching the username shape.
const RESOURCE_FILE_EXTENSION_PATTERN = /\.(php|m?jsx?|tsx?|s?css|png|jpe?g|gif|svg|webp|json|xml|ico|woff2?|ttf|map|txt)$/i;

/** Parses ONE candidate Instagram URL with the WHATWG URL parser (never a
 * substring/regex guess at the hostname) and returns a validated username
 * only if: the host is exactly instagram.com/www.instagram.com (excludes
 * l.instagram.com redirect trackers, graph.instagram.com API host,
 * scontent*.cdninstagram.com static asset hosts, etc.), the first path
 * segment — and ONLY the first segment, never query/hash/redirect
 * parameters — passes INSTAGRAM_USERNAME_PATTERN, and it isn't a known
 * non-profile route. Root cause of the "_n"/"rsrc.php" false positives:
 * the previous implementation matched ANY "instagram.com/..." substring
 * anywhere in the HTML (including inside unrelated JS bundles, redirect
 * query strings, and share-button internals) and accepted almost
 * anything shaped like a short token; this instead requires the URL to
 * structurally BE a real Instagram profile URL. */
export function parseInstagramProfileUrl(rawUrl: string): { username: string; url: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, "https://www.instagram.com/");
  } catch {
    return null;
  }
  const host = parsed.hostname.toLocaleLowerCase("en-US");
  if (host !== "instagram.com" && host !== "www.instagram.com") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (!segments.length) return null;
  const rawSegment = segments[0];
  if (RESOURCE_FILE_EXTENSION_PATTERN.test(rawSegment)) return null;
  const candidate = rawSegment.toLocaleLowerCase("en-US");
  if (!INSTAGRAM_USERNAME_PATTERN.test(candidate)) return null;
  if (INSTAGRAM_NON_PROFILE_PATHS.has(candidate)) return null;
  // A profile URL has exactly one meaningful path segment (optionally a
  // trailing slash) — "/username/tagged" or "/username/p/xyz" are a
  // sub-resource of that profile, not evidence to reject, but reduces
  // false confidence on ambiguous multi-segment paths by still using the
  // first segment only (already done above) rather than any deeper one.
  return { username: candidate, url: `https://www.instagram.com/${candidate}/` };
}

// Matches a candidate Instagram URL wherever it appears in the page — a
// plain HTML `href=`/`src=` attribute, but also (confirmed necessary
// against a real site during testing) inline JSON blobs/RSC payloads
// modern frameworks embed as page content, e.g. a JSON string like
// "Web sitesi: https://www.instagram.com/handle/". Safe to match broadly
// because, unlike the previous implementation, every match is then routed
// through parseInstagramProfileUrl's strict positive validation (real
// host, real username shape, no known non-profile path, no resource file
// extension) — the defense against false positives is that validation
// gate, not where in the page the URL happened to appear.
const CANDIDATE_URL_PATTERN = /https?:\/\/(?:[a-z0-9.-]*\.)?instagram\.com\/[^\s"'<>\\)]*/gi;

/** A business linking to its OWN Instagram from its OWN public website is
 * about the highest-confidence, lowest-risk signal available — no
 * Instagram API call, no scraping of Instagram itself, just reading
 * markers already present in the same HTML this function already fetches
 * for Pixel/Tag detection. */
export function extractInstagramProfile(html: string): { username: string; url: string } | null {
  for (const match of html.matchAll(CANDIDATE_URL_PATTERN)) {
    const profile = parseInstagramProfileUrl(match[0]);
    if (profile) return profile;
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

  // Google Places sometimes lists a business's own Instagram profile AS
  // its "website" field. That is the single most direct, reliable signal
  // available — parse it straight from the URL itself rather than
  // fetching the Instagram page and scanning ITS html for a self-link
  // (which is exactly what produced internal-fragment false positives
  // like "_n"). Meta Pixel/Google Tag detection is meaningless on
  // instagram.com itself, so those stay null (not false — "not
  // applicable" is not the same claim as "checked and absent").
  const directInstagramProfile = parseInstagramProfileUrl(url);
  if (directInstagramProfile) {
    return { metaPixelDetected: null, googleTagDetected: null, whatsappLinkDetected: null, instagramProfile: directInstagramProfile, scanFailed: false, checkedAt };
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

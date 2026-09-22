// Müşteri Keşfi — Instagram/digital-presence verification for discovery
// candidates. Zero external imports (pure, unit-testable without @/ alias
// resolution — same pattern as connect-capabilities.ts).
//
// HARD CONSTRAINT (verified against the actual connected Instagram
// integration, src/lib/social-autopilot/instagram-graph-client.ts): HK
// Dijital's Instagram connection uses "Instagram API with Instagram
// Login" (graph.instagram.com, scopes instagram_business_basic/
// _content_publish/_manage_insights/_manage_comments). That product only
// ever returns data for the ONE connected account itself — it has no
// Business Discovery field (that field exists only on the older,
// Facebook-Page-linked Instagram Graph API, a different OAuth product HK
// Dijital is not integrated with). There is therefore NO official,
// permission-safe way to fetch a third-party candidate's real follower
// count, media count, posting frequency, or engagement — attempting it
// would mean scraping, which is explicitly out of scope. Every field
// below that would require that data is intentionally never populated;
// profile matching (which IS possible, safely, from the business's own
// published website link) and a manual-review flag are the honest ceiling
// here.
export type InstagramMatchConfidence = "HIGH" | "NOT_FOUND";

export type InstagramVerification = {
  profileFound: boolean;
  username: string | null;
  profileUrl: string | null;
  matchConfidence: InstagramMatchConfidence;
  dataAvailable: false;
  analysisConfidence: "manual_check_required";
  checkedAt: string;
};

/** matchSource "website_link" is the only signal used — the business's own
 * public website explicitly linking to the profile is the one available
 * signal confident enough to report as HIGH rather than guess. No
 * username-similarity or name-based guessing is used (LOW-confidence
 * guesses are explicitly out of scope per the task). */
export function buildInstagramVerification(
  websiteProfile: { username: string; url: string } | null,
  checkedAt: string
): InstagramVerification {
  return {
    profileFound: Boolean(websiteProfile),
    username: websiteProfile?.username ?? null,
    profileUrl: websiteProfile?.url ?? null,
    matchConfidence: websiteProfile ? "HIGH" : "NOT_FOUND",
    dataAvailable: false,
    analysisConfidence: "manual_check_required",
    checkedAt
  };
}

export type HkDigitalNeedLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type HkDigitalNeedSignals = {
  hasWebsite: boolean;
  websiteScanFailed: boolean;
  instagramFound: boolean;
  metaPixelDetected: boolean | null;
  googleTagDetected: boolean | null;
  googleRating: number | null;
  reviewCount: number;
};

export type HkDigitalNeedResult = {
  level: HkDigitalNeedLevel;
  reasons: string[];
};

/** Deterministic, explainable — never a model "feeling". Separate from
 * (and never overwrites) the existing HK Opportunity Score; this is an
 * advisory sales-priority signal answering a different question ("does
 * this business have multiple, independently-verified real digital gaps
 * HK Dijital can solve?"), not a replacement scoring system.
 *
 * Calibration (fixed after a real-world false-positive review — e.g. a
 * 137-review, well-rated business was wrongly flagged HIGH from a single
 * missing signal): no single weak-presence signal — missing website, no
 * Instagram link found, or no ad-tracking code detected — may push a
 * candidate to HIGH by itself, and no simple pair may either.
 *
 * Missing website is NOT treated as a meaningful gap on its own — many
 * real, successful businesses (especially Instagram-first sectors: nail
 * studios, salons, barbers) deliberately never build a website, so its
 * absence says little about digital marketing need. It is ALSO
 * structurally not independent from "Instagram not found": with no
 * website, there is nothing to scan a link from, so that signal would be
 * trivially false too — combining the two would silently double-count one
 * fact as two. Missing-website candidates therefore cap at MEDIUM (never
 * HIGH), regardless of reputation.
 *
 * HIGH requires ALL of, together:
 *   - hasWebsite: true (the business already built one — so its social-
 *     link and tracking gaps are genuinely their own choices, not merely
 *     "no site at all"),
 *   - no Instagram link found on that site, AND no tracking code detected
 *     on it (both real, independent gaps on an asset that does exist),
 *   - a real reputation signal (rating + review count) — high real-world
 *     demand that the business isn't converting through its own digital
 *     channels.
 * Tracking absence alone, or paired only with itself, never reaches HIGH
 * — it is reported as a reason but is the weakest of the three signals
 * and never sufficient by itself.
 *
 * LOW requires a genuinely strong, multi-part confirmed presence
 * (website + Instagram link + at least one tracking snippet together).
 * Everything else with any real signal is MEDIUM. No signal at all is
 * UNKNOWN — never guessed up to HIGH. */
export function computeHkDigitalNeedLevel(signals: HkDigitalNeedSignals): HkDigitalNeedResult {
  const reasons: string[] = [];
  const hasRatingSignal = signals.googleRating !== null && signals.reviewCount > 0;
  const hasAdSignal = !signals.websiteScanFailed && (signals.metaPixelDetected !== null || signals.googleTagDetected !== null);
  const trackingDetected = Boolean(signals.metaPixelDetected || signals.googleTagDetected);

  // Not enough real signal to say anything responsible.
  if (!hasRatingSignal && !hasAdSignal && !signals.hasWebsite) {
    return { level: "UNKNOWN", reasons: ["Yeterli gerçek sinyal yok (Google puanı, web sitesi veya reklam sinyali bulunamadı) — doğrulama gerekli."] };
  }

  const strongReputation = hasRatingSignal && signals.googleRating! >= 4.3 && signals.reviewCount >= 15;
  if (strongReputation) reasons.push(`Google puanı ${signals.googleRating} (${signals.reviewCount} yorum) — güçlü itibar/müşteri kazanım sinyali.`);
  else if (hasRatingSignal) reasons.push(`Google puanı ${signals.googleRating} (${signals.reviewCount} yorum).`);

  if (!signals.hasWebsite) reasons.push("Web sitesi bulunamadı (özellikle Instagram odaklı sektörlerde bu tek başına sınırlı bir sinyaldir).");
  if (signals.hasWebsite && !signals.instagramFound) reasons.push("Web sitesinden Instagram profiline bağlantı bulunamadı (bu, Instagram hesabının olmadığı anlamına gelmez — doğrulama gerekir).");
  if (hasAdSignal && !trackingDetected) reasons.push("Web sitesinde Meta Pixel/Google Tag tespit edilmedi.");

  const strongDigitalPresence = signals.hasWebsite && signals.instagramFound && trackingDetected;
  if (strongDigitalPresence) reasons.push("Web sitesi, Instagram profili ve reklam takip kodu birlikte mevcut — dijital altyapı kurulu.");

  // Both real, independent gaps must be confirmed on an EXISTING website
  // — missing-website candidates never reach HIGH (see calibration note).
  const confirmedGapsOnExistingWebsite = signals.hasWebsite && !signals.instagramFound && !trackingDetected;

  if (strongReputation && confirmedGapsOnExistingWebsite) return { level: "HIGH", reasons };
  if (strongDigitalPresence) return { level: "LOW", reasons };
  if (hasRatingSignal || hasAdSignal || signals.hasWebsite) return { level: "MEDIUM", reasons: reasons.length ? reasons : ["Kısmi dijital varlık sinyali var; net bir boşluk veya güçlü kurulum doğrulanamadı."] };
  return { level: "UNKNOWN", reasons: ["Yeterli gerçek sinyal yok — doğrulama gerekli."] };
}

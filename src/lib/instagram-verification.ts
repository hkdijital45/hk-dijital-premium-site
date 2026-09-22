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
 * this business's real-world reputation outpace its digital presence?"),
 * not a replacement scoring system. Defaults to UNKNOWN whenever there
 * isn't enough real signal — never guesses its way to HIGH. */
export function computeHkDigitalNeedLevel(signals: HkDigitalNeedSignals): HkDigitalNeedResult {
  const reasons: string[] = [];
  const hasRatingSignal = signals.googleRating !== null && signals.reviewCount > 0;
  const hasAdSignal = !signals.websiteScanFailed && (signals.metaPixelDetected !== null || signals.googleTagDetected !== null);

  // Not enough real signal to say anything responsible.
  if (!hasRatingSignal && !hasAdSignal && !signals.hasWebsite) {
    return { level: "UNKNOWN", reasons: ["Yeterli gerçek sinyal yok (Google puanı, web sitesi veya reklam sinyali bulunamadı) — doğrulama gerekli."] };
  }

  const strongService = hasRatingSignal && signals.googleRating! >= 4.3 && signals.reviewCount >= 15;
  if (strongService) reasons.push(`Google puanı ${signals.googleRating} (${signals.reviewCount} yorum) — gerçek müşteri memnuniyeti güçlü.`);
  else if (hasRatingSignal) reasons.push(`Google puanı ${signals.googleRating} (${signals.reviewCount} yorum).`);

  const weakDigitalPresence = !signals.hasWebsite || !signals.instagramFound || (hasAdSignal && !signals.metaPixelDetected && !signals.googleTagDetected);
  if (!signals.hasWebsite) reasons.push("Web sitesi bulunamadı.");
  if (!signals.instagramFound) reasons.push("Web sitesinden Instagram profiline bağlantı bulunamadı.");
  if (hasAdSignal && !signals.metaPixelDetected && !signals.googleTagDetected) reasons.push("Web sitesinde reklam takip kodu (Meta Pixel/Google Tag) tespit edilmedi.");

  const strongDigitalPresence = signals.hasWebsite && signals.instagramFound && (signals.metaPixelDetected || signals.googleTagDetected);
  if (strongDigitalPresence) reasons.push("Web sitesi, Instagram profili ve reklam takip kodu birlikte mevcut — dijital altyapı kurulu.");

  if (strongService && weakDigitalPresence) return { level: "HIGH", reasons };
  if (strongDigitalPresence) return { level: "LOW", reasons };
  if (hasRatingSignal || hasAdSignal || signals.hasWebsite) return { level: "MEDIUM", reasons: reasons.length ? reasons : ["Kısmi dijital varlık sinyali var; net bir boşluk veya güçlü kurulum tespit edilemedi."] };
  return { level: "UNKNOWN", reasons: ["Yeterli gerçek sinyal yok — doğrulama gerekli."] };
}

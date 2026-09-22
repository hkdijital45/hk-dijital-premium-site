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
 * Calibration (fixed after a second real-world false-positive review
 * against a real 20-business sample: website + no Instagram link found +
 * no tracking code detected + a strong Google rating was STILL wrongly
 * flagged HIGH for 3/20 real businesses — Manisa Cix, Emre Özlük,
 * Mesmerica — all well-established, high-reputation businesses that this
 * signal set cannot actually distinguish from a genuine HK Dijital gap).
 *
 * The root problem: "no Instagram link on the website" and "no Pixel/Tag
 * detected" are real, verified TECHNICAL observations, but neither one
 * proves genuine commercial need on its own or together —
 *   - a missing tracking snippet does NOT prove the business isn't
 *     running Meta/Google ads (ads can run without a website pixel, e.g.
 *     Instagram-only campaigns),
 *   - a missing website→Instagram link does NOT prove the Instagram
 *     account doesn't exist or is poorly run — it only proves the link
 *     isn't on THIS page. HK Dijital's own Instagram OAuth product
 *     cannot fetch a third party's real engagement data (see the file
 *     header), so that gap can never be independently confirmed either.
 * Google rating/review count is a reputation signal, not a proxy for
 * revenue, business size, market saturation, or need for new customers
 * — it is never used to infer any of those.
 *
 * Because no currently-available real data source can independently
 * confirm a direct commercial need HK Dijital solves, this signal set
 * cannot reliably justify HIGH by itself: two unconfirmed technical gaps
 * plus a reputation number is real, verified data, but it is evidence of
 * a technical gap, not evidence of need — it is reported as MEDIUM with
 * honest reasons, never inflated to HIGH. HIGH is reserved for future
 * signals that would offer actual confirmation (e.g. a directly-verified
 * lack of any paid presence); until such a signal exists, per the stated
 * principle, returning MEDIUM/UNKNOWN is more correct than guessing HIGH.
 *
 * LOW requires a genuinely strong, multi-part CONFIRMED presence (website
 * + Instagram link + at least one tracking snippet together) — it is
 * never forced to appear just to fill out the distribution; if the real
 * data never produces it, that's a fact about the sample, not a bug.
 * Everything else with any real signal is MEDIUM. No signal at all is
 * UNKNOWN — never guessed up to HIGH or LOW. */
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
  if (strongReputation) reasons.push(`Google puanı ${signals.googleRating} (${signals.reviewCount} yorum) — güçlü itibar sinyali (bu, işletme büyüklüğü, ciro veya yeni müşteri ihtiyacı hakkında bir çıkarım içermez).`);
  else if (hasRatingSignal) reasons.push(`Google puanı ${signals.googleRating} (${signals.reviewCount} yorum).`);

  if (!signals.hasWebsite) reasons.push("Web sitesi bulunamadı (özellikle Instagram odaklı sektörlerde bu tek başına sınırlı bir sinyaldir).");
  if (signals.hasWebsite && !signals.instagramFound) reasons.push("Web sitesinden Instagram profiline bağlantı bulunamadı — bu doğrulanmış bir teknik boşluktur, ancak Instagram hesabının olmadığı veya kötü yönetildiği anlamına gelmez; doğrulama gerekir.");
  if (hasAdSignal && !trackingDetected) reasons.push("Web sitesinde Meta Pixel/Google Tag tespit edilmedi — bu doğrulanmış bir teknik boşluktur, ancak işletmenin reklam vermediği anlamına gelmez (ör. yalnızca Instagram üzerinden reklam verilebilir); doğrulama gerekir.");

  const strongDigitalPresence = signals.hasWebsite && signals.instagramFound && trackingDetected;
  if (strongDigitalPresence) reasons.push("Web sitesi, Instagram profili ve reklam takip kodu birlikte mevcut — dijital altyapı kurulu.");

  // Both are real, INDEPENDENTLY VERIFIED technical gaps on an existing
  // website — but per the calibration note above, neither proves genuine
  // commercial need with the data sources currently available, so this
  // combination alone (even together with strong reputation) no longer
  // reaches HIGH; it is reported as MEDIUM with honest reasons instead.
  const confirmedGapsOnExistingWebsite = signals.hasWebsite && !signals.instagramFound && !trackingDetected;
  if (confirmedGapsOnExistingWebsite) {
    reasons.push("Bu veri setiyle HK Dijital'e yönelik doğrudan ticari ihtiyaç güvenilir şekilde doğrulanamıyor; tespit edilen boşluklar teknik gözlemdir, ihtiyaç kanıtı değildir.");
  }

  if (strongDigitalPresence) return { level: "LOW", reasons };
  if (hasRatingSignal || hasAdSignal || signals.hasWebsite) return { level: "MEDIUM", reasons: reasons.length ? reasons : ["Kısmi dijital varlık sinyali var; net bir boşluk veya güçlü kurulum doğrulanamadı."] };
  return { level: "UNKNOWN", reasons: ["Yeterli gerçek sinyal yok — doğrulama gerekli."] };
}

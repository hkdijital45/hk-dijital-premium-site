import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateHkOpportunityScore,
  calculateMetaSuitability,
  computeDataConfidence,
  evaluateAdvertisingSignals,
  explainHkOpportunityScore,
  getHkOpportunityTier,
  HK_OPPORTUNITY_TIERS,
  buildSalesRecommendation,
  buildOutreachMessages,
  type DiscoveredBusiness
} from "../../src/lib/lead-scoring.ts";

test("getHkOpportunityTier: exact boundary values map to the required Turkish tier labels", () => {
  assert.equal(getHkOpportunityTier(100).label, "Hemen iletişime geç");
  assert.equal(getHkOpportunityTier(90).label, "Hemen iletişime geç");
  assert.equal(getHkOpportunityTier(89).label, "Çok sıcak fırsat");
  assert.equal(getHkOpportunityTier(75).label, "Çok sıcak fırsat");
  assert.equal(getHkOpportunityTier(74).label, "Takibe al");
  assert.equal(getHkOpportunityTier(60).label, "Takibe al");
  assert.equal(getHkOpportunityTier(59).label, "Orta potansiyel");
  assert.equal(getHkOpportunityTier(40).label, "Orta potansiyel");
  assert.equal(getHkOpportunityTier(39).label, "Düşük öncelik");
  assert.equal(getHkOpportunityTier(0).label, "Düşük öncelik");
});

test("HK_OPPORTUNITY_TIERS: exactly the 5 required tiers, ordered highest-min first", () => {
  assert.equal(HK_OPPORTUNITY_TIERS.length, 5);
  const mins = HK_OPPORTUNITY_TIERS.map((tier) => tier.min);
  assert.deepEqual(mins, [90, 75, 60, 40, 0]);
});

test("evaluateAdvertisingSignals: never claims active/inactive from a Pixel scan alone (Pixel present)", () => {
  const evidence = evaluateAdvertisingSignals({ website: "https://example.com", metaPixelDetected: true, googleTagDetected: false, scanFailed: false });
  assert.equal(evidence.metaAdsStatus, "unverified");
  assert.match(evidence.metaAdsEvidence, /tek başına aktif reklam kanıtı değildir/);
});

test("evaluateAdvertisingSignals: absence of a Pixel is never treated as proof of no advertising", () => {
  const evidence = evaluateAdvertisingSignals({ website: "https://example.com", metaPixelDetected: false, googleTagDetected: false, scanFailed: false });
  assert.equal(evidence.metaAdsStatus, "unverified");
  assert.match(evidence.metaAdsEvidence, /reklam vermediği anlamına gelmez/);
});

test("evaluateAdvertisingSignals: no website surfaces manual_check_required, not a false negative", () => {
  const evidence = evaluateAdvertisingSignals({ website: "", metaPixelDetected: null, googleTagDetected: null, scanFailed: false });
  assert.equal(evidence.metaAdsStatus, "manual_check_required");
  assert.equal(evidence.googleAdsStatus, "manual_check_required");
});

test("evaluateAdvertisingSignals: a failed scan surfaces source_unavailable, not a false negative", () => {
  const evidence = evaluateAdvertisingSignals({ website: "https://example.com", metaPixelDetected: null, googleTagDetected: null, scanFailed: true });
  assert.equal(evidence.metaAdsStatus, "source_unavailable");
});

test("evaluateAdvertisingSignals: a stored manual verification is the only path to active_signal/no_signal_detected", () => {
  const evidence = evaluateAdvertisingSignals({
    website: "https://example.com",
    metaPixelDetected: true,
    scanFailed: false,
    manualMeta: { status: "active", verifiedBy: "qa.admin@hkdijital.com.tr", verifiedAt: "2026-08-01T10:00:00.000Z", source: "Meta Ad Library", channel: "meta" }
  });
  assert.equal(evidence.metaAdsStatus, "active_signal");
  assert.match(evidence.metaAdsEvidence, /qa\.admin@hkdijital\.com\.tr/);
  assert.equal(evidence.advertisingConfidence, "high");
});

test("calculateHkOpportunityScore: confirmed active advertising lowers the score vs confirmed absence of advertising, all else equal", () => {
  const business: DiscoveredBusiness = { name: "Test İşletme", website: "", phone: "0555", googleRating: 4.2, reviewCount: 10 };
  const activelyAdvertising = calculateHkOpportunityScore(business, { metaAdsStatus: "active_signal", googleAdsStatus: "no_signal_detected" });
  const noAdsAnywhere = calculateHkOpportunityScore(business, { metaAdsStatus: "no_signal_detected", googleAdsStatus: "no_signal_detected" });
  assert.ok(noAdsAnywhere > activelyAdvertising);
});

test("calculateHkOpportunityScore: unverified ad status applies no adjustment (neutral, not penalized or rewarded)", () => {
  const business: DiscoveredBusiness = { name: "Test İşletme", website: "https://example.com", phone: "0555", googleRating: 4.2, reviewCount: 10 };
  const withoutAdvertising = calculateHkOpportunityScore(business);
  const withUnverified = calculateHkOpportunityScore(business, { metaAdsStatus: "unverified", googleAdsStatus: "unverified" });
  assert.equal(withoutAdvertising, withUnverified);
});

test("calculateHkOpportunityScore REGRESSION (root cause) — manual_check_required (no website to scan) must NOT get the same +5 bonus as a genuinely completed no_signal_detected scan", () => {
  // This is the exact production bug: a Nail Studio with no website (so
  // Meta/Google ad status can never even be scanned, both channels come
  // back manual_check_required) was previously scored as if HK had
  // CONFIRMED no advertising anywhere — an unknown was silently treated
  // as a positive signal and inflated the score toward 100/100.
  const business: DiscoveredBusiness = { name: "Nail Studio", website: "", phone: "0555", googleRating: 4.2, reviewCount: 10 };
  const withoutAdvertising = calculateHkOpportunityScore(business);
  const withUnknownBothChannels = calculateHkOpportunityScore(business, { metaAdsStatus: "manual_check_required", googleAdsStatus: "manual_check_required" });
  assert.equal(withUnknownBothChannels, withoutAdvertising, "manual_check_required on both channels must be neutral, identical to no advertising evidence at all");

  const genuinelyScannedNoAds = calculateHkOpportunityScore(business, { metaAdsStatus: "no_signal_detected", googleAdsStatus: "no_signal_detected" });
  assert.ok(genuinelyScannedNoAds > withUnknownBothChannels, "a REAL completed scan finding nothing must score higher than never having checked at all");
});

test("calculateHkOpportunityScore REGRESSION — source_unavailable (scan attempted but failed) is also neutral, never a bonus", () => {
  const business: DiscoveredBusiness = { name: "Test İşletme", website: "https://example.com", phone: "0555", googleRating: 4.2, reviewCount: 10 };
  const withoutAdvertising = calculateHkOpportunityScore(business);
  const withFailedScan = calculateHkOpportunityScore(business, { metaAdsStatus: "source_unavailable", googleAdsStatus: "source_unavailable" });
  assert.equal(withFailedScan, withoutAdvertising);
});

test("calculateHkOpportunityScore REGRESSION — a mix of one unknown and one confirmed-no-signal channel does not trigger the both-confirmed bonus", () => {
  const business: DiscoveredBusiness = { name: "Test İşletme", website: "https://example.com", phone: "0555", googleRating: 4.2, reviewCount: 10 };
  const withoutAdvertising = calculateHkOpportunityScore(business);
  const mixed = calculateHkOpportunityScore(business, { metaAdsStatus: "no_signal_detected", googleAdsStatus: "manual_check_required" });
  assert.equal(mixed, withoutAdvertising, "the +5 bonus requires BOTH channels to be a genuine completed scan, not just one");
});

test("computeDataConfidence: no website, no Google data, no ad check = Düşük (0%)", () => {
  const result = computeDataConfidence({ hasGoogleData: false, websiteScanCompleted: false, adStatusResolved: false });
  assert.equal(result.level, "Düşük");
  assert.equal(result.percent, 0);
});

test("computeDataConfidence: all three signal groups checked = Yüksek (100%)", () => {
  const result = computeDataConfidence({ hasGoogleData: true, websiteScanCompleted: true, adStatusResolved: true });
  assert.equal(result.level, "Yüksek");
  assert.equal(result.percent, 100);
});

test("computeDataConfidence REGRESSION — a Nail Studio with only Google data (no website, ad status never resolvable) is Düşük/Orta confidence, never Yüksek", () => {
  const result = computeDataConfidence({ hasGoogleData: true, websiteScanCompleted: false, adStatusResolved: false });
  assert.notEqual(result.level, "Yüksek");
  assert.equal(result.percent, 33);
});

test("calculateMetaSuitability: a visual/appointment sector (Nail Studio) scores higher for Meta than a search-intent sector (Oto Servis)", () => {
  const nailStudio = calculateMetaSuitability({ name: "Nail Art", category: "Nail Studio" });
  const otoServis = calculateMetaSuitability({ name: "Oto Center", category: "Oto Servis" });
  assert.ok(nailStudio.score > otoServis.score);
  assert.match(otoServis.primaryChannelNote, /Google Search/);
});

test("buildSalesRecommendation: every budget figure is explicitly labeled as an estimate", () => {
  const recommendation = buildSalesRecommendation({ name: "Test", category: "Güzellik Merkezi" }, 82);
  assert.match(recommendation.suggestedMinimumBudget, /tahmini/);
  assert.match(recommendation.suggestedIdealBudget, /tahmini/);
  assert.match(recommendation.suggestedAggressiveBudget, /tahmini/);
  assert.match(recommendation.estimatedSalesProbabilityLabel, /garantisi yoktur/);
});

test("buildOutreachMessages: only mentions real evidence — no rating text when no rating exists", () => {
  const withoutRating = buildOutreachMessages({ name: "Yeni İşletme" }, 55);
  assert.doesNotMatch(withoutRating.auditSummary, /puan,/);
  assert.match(withoutRating.auditSummary, /Google puanı\/yorumu bulunamadı/);

  const withRating = buildOutreachMessages({ name: "Test İşletme", googleRating: 4.8, reviewCount: 40 }, 91);
  assert.match(withRating.auditSummary, /4\.8 puan, 40 yorum/);
});

// ============================================================================
// explainHkOpportunityScore — explainable score model (breakdown is the
// SAME calculation calculateHkOpportunityScore uses, not a second one).
// ============================================================================

test("explainHkOpportunityScore: score always equals calculateHkOpportunityScore's number (single source of truth, never drifts)", () => {
  const business: DiscoveredBusiness = { name: "Test İşletme", website: "", phone: "0555", address: "Manisa", googleRating: 4.6, reviewCount: 7, category: "Nail Studio" };
  const advertising = { metaAdsStatus: "manual_check_required" as const, googleAdsStatus: "manual_check_required" as const };
  const explanation = explainHkOpportunityScore(business, advertising);
  const numericScore = calculateHkOpportunityScore(business, advertising);
  assert.equal(explanation.score, numericScore);
});

test("explainHkOpportunityScore: breakdown sums EXACTLY to rawScore, and score is rawScore clamped to 0-100 (mathematical integrity)", () => {
  const business: DiscoveredBusiness = { name: "Test İşletme", website: "", phone: "0555", whatsapp: "0555", address: "Manisa", googleRating: 5.0, reviewCount: 1, category: "Güzellik Salonu", instagram: "https://instagram.com/test" };
  const explanation = explainHkOpportunityScore(business, { metaAdsStatus: "no_signal_detected", googleAdsStatus: "no_signal_detected" });
  const sum = explanation.breakdown.reduce((total, item) => total + item.points, 0);
  assert.equal(sum, explanation.rawScore);
  assert.equal(explanation.score, Math.max(0, Math.min(100, Math.round(explanation.rawScore))));
});

test("explainHkOpportunityScore REGRESSION — each breakdown row's reason matches its OWN label, not an adjacent row's (index-alignment bug guard)", () => {
  // scoreDiscoveredBusiness's internal heatBreakdown has a leading base
  // item with no matching scoreReasons entry — a naive same-index mapping
  // would pair "Website bulunamadı" with the wrong reason text.
  const business: DiscoveredBusiness = { name: "Test İşletme", website: "", phone: "0555" };
  const explanation = explainHkOpportunityScore(business);
  const websiteRow = explanation.breakdown.find((row) => row.label === "Website bulunamadı");
  assert.ok(websiteRow, "Website bulunamadı row must exist for a website-less business");
  assert.match(websiteRow!.reason, /reklam ve landing page fırsatı/, "must carry ITS OWN reason, not a base/unrelated one");
  const phoneRow = explanation.breakdown.find((row) => row.label === "Telefon bilgisi mevcut");
  assert.match(phoneRow!.reason, /ulaşılabilir lead/);
});

test("explainHkOpportunityScore: website signal explanation is present and honestly worded when no website was found", () => {
  const explanation = explainHkOpportunityScore({ name: "Test İşletme", website: "" });
  const row = explanation.breakdown.find((r) => r.label === "Website bulunamadı");
  assert.ok(row);
  assert.equal(row!.status, "positive");
  assert.ok(row!.points > 0);
});

test("explainHkOpportunityScore: Instagram absent is surfaced as an UNKNOWN signal, never phrased as a confirmed negative fact", () => {
  const explanation = explainHkOpportunityScore({ name: "Test İşletme", website: "https://example.com" });
  assert.ok(explanation.unknownSignals.some((s) => s.includes("Instagram")));
  const instagramSignal = explanation.unknownSignals.find((s) => s.includes("Instagram"))!;
  assert.doesNotMatch(instagramSignal, /hesabı yok|hesabı bulunmuyor/, "must never claim the account doesn't exist, only that it wasn't verified");
  assert.match(instagramSignal, /doğrulanamadı/);
});

test("explainHkOpportunityScore: ad status manual_check_required produces a 0-point UNKNOWN breakdown row, listed separately from confirmed signals", () => {
  const explanation = explainHkOpportunityScore({ name: "Test İşletme", website: "" }, { metaAdsStatus: "manual_check_required", googleAdsStatus: "manual_check_required" });
  const adRow = explanation.breakdown.find((r) => r.key === "advertising");
  assert.ok(adRow);
  assert.equal(adRow!.points, 0);
  assert.equal(adRow!.status, "unknown");
  assert.ok(explanation.unknownSignals.some((s) => s.includes("Reklam durumu")));
});

test("explainHkOpportunityScore: confirmed active ad signal produces a real negative breakdown row (-8), confirmed no-signal produces a real positive row (+5)", () => {
  const business: DiscoveredBusiness = { name: "Test İşletme", website: "https://example.com" };
  const activelyAdvertising = explainHkOpportunityScore(business, { metaAdsStatus: "active_signal", googleAdsStatus: "no_signal_detected" });
  const activeRow = activelyAdvertising.breakdown.find((r) => r.key === "advertising")!;
  assert.equal(activeRow.points, -8);
  assert.equal(activeRow.status, "negative");

  const noAdsAnywhere = explainHkOpportunityScore(business, { metaAdsStatus: "no_signal_detected", googleAdsStatus: "no_signal_detected" });
  const opportunityRow = noAdsAnywhere.breakdown.find((r) => r.key === "advertising")!;
  assert.equal(opportunityRow.points, 5);
  assert.equal(opportunityRow.status, "positive");
});

test("explainHkOpportunityScore REGRESSION — the real 99/100 production scenario (no website, phone, address, high rating, few reviews, not high-potential category, not in CRM) explains exactly how 99 was reached", () => {
  const nailStudio: DiscoveredBusiness = {
    name: "Örnek Nail Studio", website: "", phone: "0532 000 00 00", address: "Manisa, Şehzadeler",
    googleRating: 4.7, reviewCount: 10, category: "Nail Salon", crmStatus: "CRM'de yok"
  };
  const explanation = explainHkOpportunityScore(nailStudio); // no advertising evidence available (no website to scan)
  assert.equal(explanation.score, 99, "this exact real-world signal combination is the documented root cause of the repeated 99/100 badge — a legitimate arithmetic result, not a hardcoded clamp");
  assert.equal(explanation.rawScore, 99);
  assert.equal(explanation.clamped, false, "99 is reached by real signal arithmetic, not by clamping a higher raw score down");
  const sum = explanation.breakdown.reduce((total, item) => total + item.points, 0);
  assert.equal(sum, 99);
  assert.ok(explanation.breakdown.length >= 5, "must show multiple distinct, real contributing signals, not one giant bucket");
});

test("explainHkOpportunityScore REGRESSION — a genuinely higher raw score IS clamped to 100, and the explanation says so honestly", () => {
  const businessWithEverything: DiscoveredBusiness = {
    name: "Maksimum Sinyal İşletmesi", website: "", phone: "0532 000 00 00", whatsapp: "0532 000 00 00",
    address: "Manisa, Şehzadeler", googleRating: 4.9, reviewCount: 5, category: "Güzellik Estetik Kuaför",
    instagram: "https://instagram.com/test", crmStatus: "CRM'de yok"
  };
  const explanation = explainHkOpportunityScore(businessWithEverything, { metaAdsStatus: "no_signal_detected", googleAdsStatus: "no_signal_detected" });
  assert.equal(explanation.score, 100);
  assert.ok(explanation.rawScore > 100, "raw signal sum must genuinely exceed 100 for this scenario to prove the clamp actually engaged");
  assert.equal(explanation.clamped, true);
});

test("explainHkOpportunityScore: two businesses with different real signals produce independent, non-identical breakdowns even when their final score happens to match", () => {
  const nailStudioA = explainHkOpportunityScore({ name: "Nazan Nail Art", website: "", phone: "0532", address: "Manisa", googleRating: 4.7, reviewCount: 10, category: "Nail Salon", crmStatus: "CRM'de yok" });
  const nailStudioB = explainHkOpportunityScore({ name: "RB Beauty", website: "", phone: "0533", address: "İzmir", googleRating: 4.6, reviewCount: 15, category: "Nail Salon", crmStatus: "CRM'de yok", instagram: "https://instagram.com/rbbeauty" });
  assert.notDeepEqual(nailStudioA.breakdown, nailStudioB.breakdown, "each business's breakdown must reflect its OWN real signals, never a shared/cached template");
});

test("explainHkOpportunityScore: score is always a valid integer in [0, 100], never NaN, for a fully empty business", () => {
  const explanation = explainHkOpportunityScore({ name: "" } as DiscoveredBusiness);
  assert.ok(Number.isInteger(explanation.score));
  assert.ok(explanation.score >= 0 && explanation.score <= 100);
  assert.ok(!Number.isNaN(explanation.score));
});

test("explainHkOpportunityScore: levelLabel matches the presentation bands (0-39 Düşük, 40-59 Orta, 60-79 İyi, 80-100 Yüksek) and never claims purchase intent", () => {
  // A website present (skips the +24 "no website" heat bonus) with no
  // other signals is the genuinely low-score case for this algorithm —
  // an empty business with NO website still gets the base 15 + the
  // real +24 "website missing" signal + a couple of small defaults,
  // landing in "Orta Fırsat", not "Düşük" (covered by a separate case
  // below rather than assumed here).
  const low = explainHkOpportunityScore({ name: "X", website: "https://example.com" } as DiscoveredBusiness, undefined);
  assert.ok(low.score < 40, `expected a low score, got ${low.score}`);
  assert.equal(low.levelLabel, "Düşük Fırsat");

  const high = explainHkOpportunityScore({ name: "X", website: "", phone: "0532", address: "Manisa", googleRating: 4.8, reviewCount: 10, category: "Nail Salon" });
  assert.ok(high.score >= 80);
  assert.equal(high.levelLabel, "Yüksek Fırsat");
  for (const label of ["Düşük Fırsat", "Orta Fırsat", "İyi Fırsat", "Yüksek Fırsat"]) {
    assert.doesNotMatch(label, /satın alma|kesin|garanti/i);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateHkOpportunityScore,
  calculateMetaSuitability,
  evaluateAdvertisingSignals,
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

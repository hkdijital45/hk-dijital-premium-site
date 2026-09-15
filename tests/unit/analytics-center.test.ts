import test from "node:test";
import assert from "node:assert/strict";
import { comparisonPercent, previousRange } from "../../src/lib/analytics-center/date-math.ts";
import { campaignMetricKey, isCampaignMetricKey, parseCampaignMetricKey } from "../../src/lib/analytics-center/campaign-keys.ts";
import { providerMetrics, metricCapability, metricDefinition, PROVIDER_LABELS, PROVIDER_ASSET_TYPE } from "../../src/lib/analytics-center/capabilities.ts";

test("comparisonPercent: 20 -> 30 is +50%", () => {
  assert.equal(comparisonPercent(30, 20), 50);
});

test("comparisonPercent: 30 -> 20 is -33.33...%", () => {
  const result = comparisonPercent(20, 30);
  assert.ok(result !== null && Math.abs(result - -33.333) < 0.01);
});

test("comparisonPercent: 0 -> 0 is 0, not null or NaN", () => {
  assert.equal(comparisonPercent(0, 0), 0);
});

test("comparisonPercent: 0 -> positive previous is a real negative percent, not a divide-by-zero artifact", () => {
  assert.equal(comparisonPercent(0, 50), -100);
});

test("comparisonPercent: previous 0, current positive is +100 (can't express infinite growth as a ratio)", () => {
  assert.equal(comparisonPercent(40, 0), 100);
});

test("comparisonPercent: previous 0, current 0 stays 0 even though the 'previous is 0' branch runs first", () => {
  assert.equal(comparisonPercent(0, 0), 0);
});

test("comparisonPercent: either side null returns null (no data to compare), never 0 or NaN", () => {
  assert.equal(comparisonPercent(null, 10), null);
  assert.equal(comparisonPercent(10, null), null);
  assert.equal(comparisonPercent(null, null), null);
});

test("previousRange: a 7-day range is immediately followed by an equal-length 7-day previous range with no gap or overlap", () => {
  const current = { startDate: "2026-09-08", endDate: "2026-09-14" }; // 7 days inclusive
  const previous = previousRange(current);
  assert.equal(previous.endDate, "2026-09-07"); // day right before current start
  assert.equal(previous.startDate, "2026-09-01"); // same 7-day length
});

test("previousRange: a single-day range ('today') compares against exactly the single prior day", () => {
  const current = { startDate: "2026-09-14", endDate: "2026-09-14" };
  const previous = previousRange(current);
  assert.equal(previous.startDate, "2026-09-13");
  assert.equal(previous.endDate, "2026-09-13");
});

test("previousRange: correctly crosses a month boundary, preserving the 5-day length", () => {
  const current = { startDate: "2026-09-01", endDate: "2026-09-05" }; // 5 days: Sep 1-5
  const previous = previousRange(current);
  assert.equal(previous.endDate, "2026-08-31"); // day right before current start
  assert.equal(previous.startDate, "2026-08-27"); // same 5-day length: Aug 27-31
});

test("campaignMetricKey: encodes a campaign-scoped row distinctly from the account-total metric_key", () => {
  const key = campaignMetricKey("cost", "1234567890");
  assert.equal(key, "cost::campaign:1234567890");
  assert.notEqual(key, "cost");
});

test("isCampaignMetricKey: distinguishes campaign rows from account-total rows", () => {
  assert.equal(isCampaignMetricKey("cost::campaign:1234567890"), true);
  assert.equal(isCampaignMetricKey("cost"), false);
  assert.equal(isCampaignMetricKey("reach"), false);
});

test("parseCampaignMetricKey: round-trips campaignMetricKey's output", () => {
  const key = campaignMetricKey("conversionsValue", "999888777");
  const parsed = parseCampaignMetricKey(key);
  assert.deepEqual(parsed, { baseKey: "conversionsValue", campaignId: "999888777" });
});

test("parseCampaignMetricKey: returns null for an account-total (non-campaign) key", () => {
  assert.equal(parseCampaignMetricKey("cost"), null);
});

test("providerMetrics: every provider's registry is non-empty", () => {
  for (const provider of ["instagram", "facebook", "youtube", "google_ads", "google_business_profile"] as const) {
    assert.ok(providerMetrics(provider).length > 0, `${provider} should define at least one metric`);
  }
});

test("metricCapability: a deprecated Instagram metric is explicitly marked unsupported, not silently dropped", () => {
  assert.equal(metricCapability("instagram", "profile_views"), "unsupported");
  assert.equal(metricCapability("instagram", "website_clicks"), "unsupported");
});

test("metricCapability: a currently-supported metric is marked supported", () => {
  assert.equal(metricCapability("instagram", "reach"), "supported");
  assert.equal(metricCapability("google_ads", "cost"), "supported");
});

test("metricCapability: an unknown metric key for a provider is not_applicable, never a crash", () => {
  assert.equal(metricCapability("youtube", "totally_made_up_metric"), "not_applicable");
});

test("metricDefinition: an unsupported metric still carries a human-readable note explaining why", () => {
  const def = metricDefinition("instagram", "profile_views");
  assert.ok(def);
  assert.equal(def?.capability, "unsupported");
  assert.ok(def?.note && def.note.length > 0);
});

test("PROVIDER_LABELS / PROVIDER_ASSET_TYPE: every analytics provider has a label and an asset_type mapping", () => {
  for (const provider of ["instagram", "facebook", "youtube", "google_ads", "google_business_profile"] as const) {
    assert.ok(PROVIDER_LABELS[provider]);
    assert.ok(PROVIDER_ASSET_TYPE[provider]);
  }
});

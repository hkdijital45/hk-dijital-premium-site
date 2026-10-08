import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dedupeMetaMetricSnapshots } from "../../../src/lib/marketing-intelligence/meta-metrics-aggregation.ts";
import { buildMetricsSnapshot } from "../../../src/lib/marketing-intelligence/ad-evaluations.ts";

// Real MY CAKE 45 snapshots, 2026-10-02/07/08. Identifiers are anonymized;
// nested breakdown entries retain only their cardinality (the old key used
// String(array), so the contents of each object were irrelevant).
const snapshots = JSON.parse(readFileSync(new URL("./fixtures/meta-adset-breakdown-snapshots.json", import.meta.url), "utf8"));

test("changing nested breakdown counts never keeps obsolete cumulative snapshots", () => {
  const before = structuredClone(snapshots);
  assert.deepEqual(dedupeMetaMetricSnapshots(snapshots, "meta_adset_id"), [snapshots[0]]);
  assert.deepEqual(dedupeMetaMetricSnapshots([...snapshots].reverse(), "meta_adset_id"), [snapshots[0]]);
  assert.deepEqual(snapshots, before, "reading metrics must not modify stored snapshots");
});

test("MY CAKE report uses the stored 1488.85 / 17084 / 102 / 42 snapshot", () => {
  const result = buildMetricsSnapshot({ campaignMetrics: [], adsetMetrics: snapshots, adMetrics: [], metaCampaignId: "campaign-1" });
  assert.equal(result.adsets.length, 1);
  const row = result.adsets[0];
  assert.deepEqual([row.spend, row.impressions, row.linkClicks, row.results, row.reach, row.clicksAll], [1488.85, 17084, 102, 42, 6359, 421]);
  assert.equal(row.ctrAll, snapshots[0].ctr);
  assert.equal(row.cpcAll, snapshots[0].cpc);
});

test("empty, missing and populated breakdown payloads are the same reporting bucket", () => {
  const rows = snapshots.map((r: Record<string, unknown>, i: number) => ({ ...r, age_breakdown: i === 0 ? [] : i === 1 ? null : [{ age: "25-34" }] }));
  assert.deepEqual(dedupeMetaMetricSnapshots(rows, "meta_adset_id"), [rows[0]]);
});

test("latest campaign batch keeps all daily rows, but drops every older day", () => {
  const rows = [
    { meta_campaign_id: "campaign-1", date: "2026-10-01", created_at: "2026-10-08T12:00:00Z", spend: 239.61 },
    { meta_campaign_id: "campaign-1", date: "2026-10-02", created_at: "2026-10-08T12:00:00Z", spend: 144.14 },
    { meta_campaign_id: "campaign-1", date: "2026-10-01", created_at: "2026-10-02T12:00:00Z", spend: 239.58 }
  ];
  assert.deepEqual(dedupeMetaMetricSnapshots(rows, "meta_campaign_id"), rows.slice(0, 2));
});

test("separate presets and real entities remain separate", () => {
  const rows = [snapshots[0], { ...snapshots[1], date_range_label: "Son 7 Gün" }, { ...snapshots[2], meta_adset_id: "adset-2" }];
  assert.deepEqual(dedupeMetaMetricSnapshots(rows, "meta_adset_id"), rows);
});

test("a later corrected total wins even when its value decreases", () => {
  const rows = [snapshots[0], { ...snapshots[0], created_at: "2026-10-09T12:00:00Z", updated_at: "2026-10-09T12:00:00Z", spend: 1400 }];
  assert.deepEqual(dedupeMetaMetricSnapshots(rows, "meta_adset_id"), [rows[1]]);
});

// resolveCampaignBudget regression coverage — proven necessary live
// (MY CAKE 45): campaigns.daily_budget/total_budget are genuinely 0
// (Campaign Budget Optimization is off), while the campaign's one real
// ad set has a genuine 200 TL/day budget in meta_adset_metrics. Budget
// is a CONFIGURATION value, never a cumulative performance metric, so
// it must never be summed/deduped the way spend/impressions are.
import test from "node:test";
import assert from "node:assert/strict";
import { resolveCampaignBudget, resolveCampaignSpend, resolveCampaignClickMetrics } from "../../../src/lib/marketing-intelligence/meta-metrics-aggregation.ts";

test("resolveCampaignBudget: CASE A — campaign-level daily budget wins outright, ad set budgets are never consulted", () => {
  const info = resolveCampaignBudget({ daily_budget: 500, total_budget: 0 }, [{ meta_adset_id: "as1", adset_name: "Set A", daily_budget: 200 }]);
  assert.deepEqual(info, { level: "campaign", daily: 500, lifetime: null });
});

test("resolveCampaignBudget: CASE B — campaign-level lifetime (total) budget, no daily budget", () => {
  const info = resolveCampaignBudget({ daily_budget: 0, total_budget: 6000 }, []);
  assert.deepEqual(info, { level: "campaign", daily: null, lifetime: 6000 });
});

test("resolveCampaignBudget: CASE C — no campaign budget, exactly one real ad set with a budget — reported as ad-set-level, never as 0 TL", () => {
  const info = resolveCampaignBudget({ daily_budget: 0, total_budget: 0 }, [{ meta_adset_id: "as1", adset_name: "MYCAKE-IG-DM-01", daily_budget: 200, lifetime_budget: 0 }]);
  assert.deepEqual(info, { level: "adset", name: "MYCAKE-IG-DM-01", daily: 200, lifetime: null });
});

test("resolveCampaignBudget: CASE C — single ad set lifetime budget", () => {
  const info = resolveCampaignBudget(null, [{ meta_adset_id: "as1", adset_name: "Set A", daily_budget: 0, lifetime_budget: 3000 }]);
  assert.deepEqual(info, { level: "adset", name: "Set A", daily: null, lifetime: 3000 });
});

test("resolveCampaignBudget: CASE D — multiple ad sets with separate budgets are never falsely reported as one campaign-level number; a total is offered but explicitly not labeled campaign budget", () => {
  const info = resolveCampaignBudget({ daily_budget: 0 }, [
    { meta_adset_id: "as1", adset_name: "Ad Set A", daily_budget: 200 },
    { meta_adset_id: "as2", adset_name: "Ad Set B", daily_budget: 300 }
  ]);
  assert.equal(info.level, "adsets");
  if (info.level === "adsets") {
    assert.equal(info.adsets.length, 2);
    assert.equal(info.totalDailyAcrossAdsets, 500);
  }
});

test("resolveCampaignBudget: CASE E — genuinely no budget anywhere (synced ad sets exist, none have a budget) is distinguished from 'never synced at all'", () => {
  const noneButSynced = resolveCampaignBudget({ daily_budget: 0 }, [{ meta_adset_id: "as1", adset_name: "Set A", daily_budget: 0, lifetime_budget: 0 }]);
  assert.deepEqual(noneButSynced, { level: "none", hasAnySyncedAdset: true });

  const neverSynced = resolveCampaignBudget({ daily_budget: 0 }, []);
  assert.deepEqual(neverSynced, { level: "none", hasAnySyncedAdset: false });
});

test("resolveCampaignBudget: a genuine real zero budget value is never confused with a missing one — campaign level explicitly reports a real 0 only when some OTHER field is actually > 0 (never both at once in this schema, but the none-case proves zero never silently becomes a fabricated number)", () => {
  const info = resolveCampaignBudget({ daily_budget: 0, total_budget: 0, budget: 0 }, []);
  assert.equal(info.level, "none");
});

test("resolveCampaignBudget: spend/performance metrics are completely ignored — only daily_budget/lifetime_budget/total_budget/budget configuration fields are read, never summed across sync batches", () => {
  const info = resolveCampaignBudget({ daily_budget: 0 }, [
    { meta_adset_id: "as1", adset_name: "Set A", daily_budget: 200, spend: 9999, impressions: 99999 }
  ]);
  assert.deepEqual(info, { level: "adset", name: "Set A", daily: 200, lifetime: null });
});

test("resolveCampaignBudget: multiple rows for the SAME real ad set id (e.g. a same-batch day-split row pair) never double the reported budget — grouped strictly by entity id, first row's config wins", () => {
  const info = resolveCampaignBudget({ daily_budget: 0 }, [
    { meta_adset_id: "as1", adset_name: "Set A", daily_budget: 200 },
    { meta_adset_id: "as1", adset_name: "Set A", daily_budget: 200 }
  ]);
  assert.deepEqual(info, { level: "adset", name: "Set A", daily: 200, lifetime: null });
});

// --- resolveCampaignSpend: production hotfix (campaign row/detail "Harcama: 0 TL") ---
// Root cause: GrowthOperatingSystem.tsx's campaign row/detail previously
// read campaigns.spent_budget/spent — stale legacy columns that are
// genuinely 0 for MY CAKE 45 (never kept in sync with real performance
// data) — while the real, canonical campaign_metrics spend for the same
// campaign/period is ~306 TL. resolveCampaignSpend resolves THIS
// campaign's own canonical spend, never a copy of a page-wide total and
// never a sum across campaign/adset/ad entity layers.

test("resolveCampaignSpend: canonical campaign spend exists -> returned directly, matching the proven-live 305.97 TL for MY CAKE 45", () => {
  const spend = resolveCampaignSpend(
    { id: "camp1", meta_campaign_id: "m1" },
    [{ meta_campaign_id: "m1", spend: 239.58 }, { meta_campaign_id: "m1", spend: 66.39 }]
  );
  assert.equal(spend, 305.97);
});

test("resolveCampaignSpend: a genuinely missing canonical row returns null, never a fabricated 0 — caller falls back to the legacy field only in this case", () => {
  assert.equal(resolveCampaignSpend({ id: "camp1", meta_campaign_id: "m1" }, []), null);
  assert.equal(resolveCampaignSpend({ id: "camp1", meta_campaign_id: "m1" }, [{ meta_campaign_id: "m2", spend: 999 }]), null);
});

test("resolveCampaignSpend: multiple campaigns each resolve their OWN spend by their own id — the page-wide total is never copied into every row", () => {
  const rows = [
    { meta_campaign_id: "mA", spend: 100 },
    { meta_campaign_id: "mB", spend: 250 },
    { meta_campaign_id: "mC", spend: 50 }
  ];
  assert.equal(resolveCampaignSpend({ id: "a", meta_campaign_id: "mA" }, rows), 100);
  assert.equal(resolveCampaignSpend({ id: "b", meta_campaign_id: "mB" }, rows), 250);
  assert.equal(resolveCampaignSpend({ id: "c", meta_campaign_id: "mC" }, rows), 50);
});

test("resolveCampaignSpend: never sums across campaign/adset/ad entity layers — only reads campaign_metrics rows passed in; a row with no matching campaign identity contributes nothing", () => {
  const spend = resolveCampaignSpend({ id: "camp1", meta_campaign_id: "m1" }, [
    { meta_campaign_id: "m1", spend: 305.97 },
    { meta_adset_id: "as1", spend: 305.97 }
  ]);
  assert.equal(spend, 305.97, "a row with no matching campaign identity must never be summed in");
});

test("resolveCampaignSpend: falls back to campaign_id when meta_campaign_id is absent on the campaign (non-Meta/manual campaign)", () => {
  const spend = resolveCampaignSpend({ id: "camp1" }, [{ campaign_id: "camp1", spend: 42 }, { campaign_id: "campOther", spend: 999 }]);
  assert.equal(spend, 42);
});

// --- resolveCampaignClickMetrics: Link vs All click family UI labels ---
// Root cause: GrowthOperatingSystem.tsx's selected-campaign detail
// panel averaged raw per-row ctr/cpc (Meta's native all-click rate)
// unweighted across a sync batch's day-split rows, and showed it under
// one ambiguous "CTR / CPC / CPM" label that also silently discarded
// the genuinely separate link-click family already visible elsewhere
// on the same screen (top KPI cards).

test("resolveCampaignClickMetrics: link vs all-click families are both resolved from the same rows and are never equal by construction when all-click count differs — matches the proven-live MY CAKE 45 shape (linkCtr distinct from ctrAll)", () => {
  const metrics = resolveCampaignClickMetrics([
    { spend: 239.58, impressions: 3135, clicks: 25, ctr: 2.870813, cpc: 2.662 },
    { spend: 66.39, impressions: 830, clicks: 3, ctr: 2.168674, cpc: 3.284155 }
  ]);
  assert.ok(metrics);
  assert.notEqual(metrics!.linkCtr, metrics!.ctrAll, "link CTR and all-click CTR must be distinct values, never collapsed into one");
  assert.notEqual(metrics!.linkCpc, metrics!.cpcAll, "link CPC and all-click CPC must be distinct values, never collapsed into one");
});

test("resolveCampaignClickMetrics: both families render safely and independently side by side — neither overwrites the other", () => {
  const metrics = resolveCampaignClickMetrics([{ spend: 100, impressions: 1000, clicks: 10, ctr: 5, cpc: 2 }]);
  assert.ok(metrics);
  assert.ok(metrics!.linkCtr != null && metrics!.ctrAll != null);
  assert.ok(metrics!.linkCpc != null && metrics!.cpcAll != null);
});

test("resolveCampaignClickMetrics: CPM is the true weighted spend/impressions rate, unchanged canonical formula (no new frontend formula)", () => {
  const metrics = resolveCampaignClickMetrics([{ spend: 239.58, impressions: 3135 }, { spend: 66.39, impressions: 830 }]);
  assert.equal(metrics!.cpm, Number((((239.58 + 66.39) / (3135 + 830)) * 1000).toFixed(2)));
});

test("resolveCampaignClickMetrics: no rows -> null, never a fabricated metric set", () => {
  assert.equal(resolveCampaignClickMetrics([]), null);
});

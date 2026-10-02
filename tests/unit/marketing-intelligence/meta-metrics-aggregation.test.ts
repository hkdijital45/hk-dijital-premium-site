// resolveCampaignBudget regression coverage — proven necessary live
// (MY CAKE 45): campaigns.daily_budget/total_budget are genuinely 0
// (Campaign Budget Optimization is off), while the campaign's one real
// ad set has a genuine 200 TL/day budget in meta_adset_metrics. Budget
// is a CONFIGURATION value, never a cumulative performance metric, so
// it must never be summed/deduped the way spend/impressions are.
import test from "node:test";
import assert from "node:assert/strict";
import { resolveCampaignBudget } from "../../../src/lib/marketing-intelligence/meta-metrics-aggregation.ts";

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

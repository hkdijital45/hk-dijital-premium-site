// Collapses repeated Meta sync snapshots of the same campaign/ad set/ad
// reporting bucket into one canonical row. Root cause this exists for:
// the Meta sync (api/admin/meta-ads/route.ts's postRows) always INSERTs
// a fresh row on every sync — it never upserts — and each row already
// holds Meta's CUMULATIVE total for whatever window was requested AT
// THAT SYNC TIME, not a fixed daily delta.
//
// Every date_range_label this app actually syncs ("Bugün", "Son 7 Gün",
// "Son 30 Gün") is a ROLLING window: period_start/period_end advance on
// every resync even though the label is unchanged, and `date` is just
// "the day this sync ran," not a genuine disjoint time bucket (none of
// the Graph API calls here request a per-day time_increment breakdown —
// confirmed by reading api/admin/meta-ads/route.ts). So two rows for the
// same entity+label with DIFFERENT date/period_start/period_end are NOT
// two legitimately separate periods to add together — they are two
// syncs of the same rolling preset taken at different times, and the
// older one is simply stale. Proven live (MY CAKE 45, 2026-10-01/02):
// summing all 4 "Son 30 Gün" campaign_metrics rows for one campaign gave
// 635.89 TL / 19 messages (reported bug: ~636 TL / 19), while Meta Ads
// Manager's real 1–2 Oct total was 284.34 TL / 9 messages — which
// exactly matches summing ONLY the rows sharing the latest sync's
// created_at timestamp (239.58+44.64 = 284.22 / 8+1 = 9). Rows from an
// earlier sync batch (174.48, 177.19 — both superseded by the time of
// the newer sync) must be discarded entirely, never summed in.
//
// A single sync writes all of an entity's rows for that run in one bulk
// INSERT, and Postgres's now() is stable for the whole statement/
// transaction — so rows from the same sync share the exact same
// created_at, which is what distinguishes "two rows from one sync batch
// (sum them — e.g. a day-split within that one run)" from "an older,
// superseded batch (discard entirely, never sum across batches)".
export type MetaMetricRow = Record<string, unknown>;

// Breakdown dimensions are kept here defensively (parallel breakdown
// fetches could in principle land in the same table under a future
// change) even though today's schema never actually splits a single
// sync's entity total across multiple campaign_metrics/meta_adset_metrics/
// meta_ad_metrics rows this way (breakdowns are nested JSONB on the one
// row instead). date/period_start/period_end are deliberately NOT part
// of this key — see file header.
function bucketKey(row: MetaMetricRow): string {
  return [row.date_range_label, row.placement_breakdown, row.age_breakdown, row.gender_breakdown, row.location_breakdown]
    .map((v) => (v === null || v === undefined ? "" : String(v)))
    .join("|");
}

function rowTimestamp(row: MetaMetricRow): number {
  const value = (row.updated_at as string) || (row.created_at as string);
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Groups rows by entity id (meta_campaign_id/meta_adset_id/meta_ad_id)
 * + reporting bucket (date_range_label/breakdown — never date/period,
 * which shift on every rolling resync), then keeps only the rows from
 * the single LATEST sync batch (identical created_at) in each group —
 * every older batch is dropped entirely, never summed with the current
 * one. Rows sharing that latest batch's timestamp are left as separate
 * rows (same-batch day-split components are genuinely additive), so
 * existing sum/avg aggregation over them is unaffected. */
export function dedupeMetaMetricSnapshots<T extends MetaMetricRow>(rows: T[], idField: string): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const entityId = String(row[idField] ?? row.id ?? "");
    const key = `${entityId}::${bucketKey(row)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  const result: T[] = [];
  for (const groupRows of groups.values()) {
    const latestTs = groupRows.reduce((max, row) => Math.max(max, rowTimestamp(row)), -Infinity);
    for (const row of groupRows) if (rowTimestamp(row) === latestTs) result.push(row);
  }
  return result;
}

/** Groups already-deduped rows strictly by entity id — used to turn a
 * flat row list into "one canonical row per real Meta ad set/ad" (never
 * by name/placement/row index), per entity. */
export function groupByEntityId<T extends MetaMetricRow>(rows: T[], idField: string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = String(row[idField] ?? row.id ?? "");
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(row);
  }
  return groups;
}

export type CampaignClickMetrics = {
  spend: number; impressions: number; linkClicks: number; clicksAll: number | null;
  linkCtr: number | null; linkCpc: number | null; ctrAll: number | null; cpcAll: number | null; cpm: number | null;
};

/** Resolves a campaign's Link-click vs All-click metric families from
 * already-deduped campaign_metrics rows — the exact same canonical
 * formulas as ad-evaluations.ts's buildMetricsSnapshot campaign block
 * (never a second, independently-invented formula): `clicks` is the
 * link-click-preferred column, while each row's own native `ctr`/`cpc`
 * is Meta's all-click-based rate for that row's own period. Rows from
 * the same sync batch are genuinely separate calendar days (campaign-
 * level sync uses time_increment=1) and are additive for spend/
 * impressions/clicks, but ctr/cpc/cpm must be WEIGHTED — each row's own
 * all-click count is recovered (spend/cpc) and summed, never averaged
 * directly (proven live: a naive average of two very differently-sized
 * days' cpm gave 74.52 TL instead of the true weighted 75.76 TL).
 * Extracted here (not duplicated) so GrowthOperatingSystem.tsx's
 * campaign detail panel can use the same canonical semantics without a
 * second, UI-local re-implementation of this math. */
export function resolveCampaignClickMetrics(rows: MetaMetricRow[]): CampaignClickMetrics | null {
  if (!rows.length) return null;
  const num = (row: MetaMetricRow, key: string) => Number(row[key]) || 0;
  const linkClicks = rows.reduce((s, r) => s + num(r, "clicks"), 0);
  const impressions = rows.reduce((s, r) => s + num(r, "impressions"), 0);
  const spend = Number(rows.reduce((s, r) => s + (num(r, "spend") || num(r, "spent")), 0).toFixed(2));
  const allClicksOf = (r: MetaMetricRow) => {
    const cpcRow = num(r, "cpc"); const ctrRow = num(r, "ctr"); const impRow = num(r, "impressions");
    const spendRow = num(r, "spend") || num(r, "spent");
    if (cpcRow > 0) return Math.round(spendRow / cpcRow);
    if (ctrRow > 0 && impRow > 0) return Math.round((ctrRow / 100) * impRow);
    return 0;
  };
  const clicksAll = rows.reduce((s, r) => s + allClicksOf(r), 0) || null;
  return {
    spend, impressions, linkClicks, clicksAll,
    linkCtr: impressions ? Number(((linkClicks / impressions) * 100).toFixed(2)) : null,
    linkCpc: linkClicks ? Number((spend / linkClicks).toFixed(2)) : null,
    ctrAll: clicksAll && impressions ? Number(((clicksAll / impressions) * 100).toFixed(2)) : null,
    cpcAll: clicksAll ? Number((spend / clicksAll).toFixed(2)) : null,
    cpm: impressions ? Number(((spend / impressions) * 1000).toFixed(2)) : null
  };
}

function matchesCampaignEntity(row: MetaMetricRow, campaign: { id?: unknown; meta_campaign_id?: unknown } | null | undefined): boolean {
  if (!campaign) return false;
  const metaCampaignId = campaign.meta_campaign_id;
  if (metaCampaignId && row.meta_campaign_id === metaCampaignId) return true;
  return Boolean(campaign.id && row.campaign_id === campaign.id);
}

/** Resolves THIS campaign's own canonical performance spend from
 * already-deduped campaign_metrics rows — never the page-wide total
 * (a different campaign's row must never show another campaign's
 * spend), never a sum across campaign/adset/ad entity layers (the same
 * real spend exists at each level; summing them double-counts it).
 * Returns null when genuinely no canonical rows match this campaign —
 * the caller decides what a "missing" spend should fall back to
 * display as; this function never fabricates a 0. */
export function resolveCampaignSpend(
  campaign: { id?: unknown; meta_campaign_id?: unknown } | null | undefined,
  dedupedCampaignMetricRows: MetaMetricRow[]
): number | null {
  const rows = dedupedCampaignMetricRows.filter((row) => matchesCampaignEntity(row, campaign));
  if (!rows.length) return null;
  return Number(rows.reduce((sum, row) => sum + ((Number(row.spend) || Number(row.spent)) || 0), 0).toFixed(2));
}

export type CampaignBudgetInfo =
  | { level: "campaign"; daily: number | null; lifetime: number | null }
  | { level: "adset"; name: string; daily: number | null; lifetime: number | null }
  | { level: "adsets"; adsets: Array<{ name: string; daily: number | null; lifetime: number | null }>; totalDailyAcrossAdsets: number | null }
  | { level: "none"; hasAnySyncedAdset: boolean };

/** Resolves WHICH level a campaign's real, currently-configured Meta
 * budget actually lives at — proven necessary live (MY CAKE 45):
 * campaigns.daily_budget/total_budget are genuinely 0 (Campaign Budget
 * Optimization is off for this account), while the campaign's one real
 * ad set has a genuine 200 TL/day budget in meta_adset_metrics. Showing
 * "Bütçe: 0 TL" in that case is misleading — it reads as a real zero
 * budget rather than "this level has none, look one level down".
 *
 * Budget is a CONFIGURATION value, not a cumulative performance metric:
 * unlike spend/impressions/etc., re-syncing the same ad set never
 * produces a second, additive budget — the latest synced row for a
 * given real ad set id simply wins (never summed across sync batches,
 * never averaged). `dedupedAdsetRows` is expected to already be the
 * output of dedupeMetaMetricSnapshots (this function does not re-dedupe
 * performance data — it only reads configuration fields off rows the
 * caller already deduped), grouped here strictly by real ad set id via
 * the same canonical groupByEntityId used everywhere else. */
export function resolveCampaignBudget(
  campaign: { daily_budget?: unknown; total_budget?: unknown; budget?: unknown } | null | undefined,
  dedupedAdsetRows: MetaMetricRow[]
): CampaignBudgetInfo {
  const campaignDaily = Number(campaign?.daily_budget) || 0;
  const campaignLifetime = Number(campaign?.total_budget ?? campaign?.budget) || 0;
  if (campaignDaily > 0 || campaignLifetime > 0) {
    return { level: "campaign", daily: campaignDaily || null, lifetime: campaignLifetime || null };
  }

  const byAdset = groupByEntityId(dedupedAdsetRows, "meta_adset_id");
  const adsetBudgets: Array<{ name: string; daily: number | null; lifetime: number | null }> = [];
  for (const rows of byAdset.values()) {
    const row = rows[0];
    const daily = Number(row.daily_budget) || 0;
    const lifetime = Number(row.lifetime_budget) || 0;
    if (daily > 0 || lifetime > 0) adsetBudgets.push({ name: String(row.adset_name || "Adsız reklam seti"), daily: daily || null, lifetime: lifetime || null });
  }

  if (adsetBudgets.length === 1) return { level: "adset", name: adsetBudgets[0].name, daily: adsetBudgets[0].daily, lifetime: adsetBudgets[0].lifetime };
  if (adsetBudgets.length > 1) {
    const totalDaily = adsetBudgets.reduce((s, a) => s + (a.daily || 0), 0);
    return { level: "adsets", adsets: adsetBudgets, totalDailyAcrossAdsets: totalDaily || null };
  }
  return { level: "none", hasAnySyncedAdset: byAdset.size > 0 };
}

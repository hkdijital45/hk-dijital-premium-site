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

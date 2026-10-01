// Collapses repeated Meta sync snapshots of the same campaign/ad set/ad
// reporting bucket into one canonical row. Root cause this exists for:
// the Meta sync (api/admin/meta-ads/route.ts's postRows) always INSERTs
// a fresh row on every sync — it never upserts — and each row already
// holds Meta's CUMULATIVE total for the whole requested date range, not
// a daily delta. Re-syncing the same period therefore produces two (or
// more) rows for the identical campaign/ad set/ad + date + period +
// breakdown, each independently correct but NOT additive with each
// other — summing them (the previous ad-evaluation behavior) silently
// doubled spend/results. Only genuinely distinct buckets (a real
// different date or Meta breakdown dimension) are ever combined.
export type MetaMetricRow = Record<string, unknown>;

function bucketKey(row: MetaMetricRow): string {
  return [
    row.date, row.period_start, row.period_end, row.date_range_label,
    row.placement_breakdown, row.age_breakdown, row.gender_breakdown, row.location_breakdown
  ].map((v) => (v === null || v === undefined ? "" : String(v))).join("|");
}

function rowTimestamp(row: MetaMetricRow): number {
  const value = (row.updated_at as string) || (row.created_at as string);
  const parsed = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Groups rows by entity id (meta_campaign_id/meta_adset_id/meta_ad_id),
 * then within each entity collapses rows sharing the same reporting
 * bucket (date + period + breakdown dimensions) down to the single
 * latest sync (by updated_at/created_at) — never a sum. Rows that are
 * genuinely different buckets for the same entity are left as separate
 * rows, so existing sum/avg aggregation over distinct real dates or
 * breakdowns is unaffected. */
export function dedupeMetaMetricSnapshots<T extends MetaMetricRow>(rows: T[], idField: string): T[] {
  const byBucket = new Map<string, T>();
  for (const row of rows) {
    const entityId = String(row[idField] ?? row.id ?? "");
    const key = `${entityId}::${bucketKey(row)}`;
    const existing = byBucket.get(key);
    if (!existing || rowTimestamp(row) >= rowTimestamp(existing)) byBucket.set(key, row);
  }
  return [...byBucket.values()];
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

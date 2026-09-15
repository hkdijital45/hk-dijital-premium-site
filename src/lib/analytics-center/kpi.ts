import "server-only";
import { providerMetrics } from "./capabilities";
import { queryDailyMetrics, type StoredDailyMetric } from "./metrics-store";
import { isCampaignMetricKey } from "./campaign-keys";
import { comparisonPercent, previousRange } from "./date-math";
import type { AnalyticsProvider, DateRange, KpiCardValue } from "./types";

export { comparisonPercent, previousRange };

// Point-in-time gauges — the latest value within a range is the meaningful
// "current" number, never a sum (summing 30 days of "followers" would be
// nonsense). Everything else is additive over the range.
const GAUGE_METRICS = new Set(["followers", "subscribers", "page_fans", "review_count", "average_rating"]);
// Rate/average metrics that are also not additive, but are meaningfully
// averaged (not just "latest") across the days that have a value.
const AVERAGE_METRICS = new Set(["averageViewDuration", "ctr", "averageCpc", "costPerConversion"]);

function aggregateByMetric(rows: StoredDailyMetric[]): Map<string, number> {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    if (isCampaignMetricKey(row.metric_key)) continue;
    const list = grouped.get(row.metric_key) || [];
    list.push(row.metric_value);
    grouped.set(row.metric_key, list);
  }
  const result = new Map<string, number>();
  for (const [key, values] of grouped) {
    if (GAUGE_METRICS.has(key)) {
      result.set(key, values[values.length - 1] ?? 0); // rows arrive ordered by metric_date asc — last is latest
    } else if (AVERAGE_METRICS.has(key)) {
      result.set(key, values.reduce((sum, v) => sum + v, 0) / values.length);
    } else {
      result.set(key, values.reduce((sum, v) => sum + v, 0));
    }
  }
  return result;
}

export async function getProviderKpis(companyId: string, provider: AnalyticsProvider, range: DateRange): Promise<KpiCardValue[]> {
  const [currentRows, previousRows] = await Promise.all([
    queryDailyMetrics(companyId, [provider], range),
    queryDailyMetrics(companyId, [provider], previousRange(range))
  ]);
  const current = aggregateByMetric(currentRows);
  const previous = aggregateByMetric(previousRows);

  return providerMetrics(provider)
    .filter((def) => def.capability === "supported")
    .map((def) => {
      const currentValue = current.has(def.key) ? current.get(def.key)! : null;
      const previousValue = previous.has(def.key) ? previous.get(def.key)! : null;
      return {
        key: def.key,
        label: def.label,
        value: currentValue,
        previousValue,
        changeAbsolute: currentValue !== null && previousValue !== null ? currentValue - previousValue : null,
        changePercent: comparisonPercent(currentValue, previousValue),
        unit: def.unit,
        capability: currentValue === null && !currentRows.length ? "supported" : def.capability,
        source: provider,
        note: def.note
      } satisfies KpiCardValue;
    });
}

export async function getAllProviderKpis(companyId: string, providers: AnalyticsProvider[], range: DateRange): Promise<Record<AnalyticsProvider, KpiCardValue[]>> {
  const entries = await Promise.all(providers.map(async (provider) => [provider, await getProviderKpis(companyId, provider, range)] as const));
  return Object.fromEntries(entries) as Record<AnalyticsProvider, KpiCardValue[]>;
}

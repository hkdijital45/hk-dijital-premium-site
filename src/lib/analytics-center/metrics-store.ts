import "server-only";
import { supabaseRest } from "@/lib/supabase";
import type { AnalyticsProvider, ContentMetricRow, DailyMetricRow, DateRange } from "./types";

// Upserts on the (company_id, provider, asset_id, metric_date, metric_key)
// unique constraint — a re-sync of "today" overwrites today's row instead
// of duplicating it, while past dates are left alone unless explicitly
// re-synced (see sync.ts's incremental window logic).
export async function writeDailyMetrics(rows: DailyMetricRow[]): Promise<number> {
  if (!rows.length) return 0;
  const payload = rows.map((row) => ({
    company_id: row.companyId,
    provider: row.provider,
    asset_id: row.assetId,
    metric_date: row.metricDate,
    metric_key: row.metricKey,
    metric_value: row.metricValue,
    currency: row.currency || null,
    dimensions: row.dimensions || {},
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  await supabaseRest("analytics_daily_metrics?on_conflict=company_id,provider,asset_id,metric_date,metric_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload)
  });
  return payload.length;
}

export async function writeContentMetrics(rows: ContentMetricRow[]): Promise<number> {
  if (!rows.length) return 0;
  const payload = rows.map((row) => ({
    company_id: row.companyId,
    provider: row.provider,
    asset_id: row.assetId,
    content_id: row.contentId,
    content_type: row.contentType || null,
    caption: row.caption || null,
    title: row.title || null,
    permalink: row.permalink || null,
    thumbnail_url: row.thumbnailUrl || null,
    published_at: row.publishedAt || null,
    metrics: row.metrics || {},
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
  await supabaseRest("analytics_content_metrics?on_conflict=company_id,provider,content_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload)
  });
  return payload.length;
}

export type StoredDailyMetric = { provider: AnalyticsProvider; asset_id: string; metric_date: string; metric_key: string; metric_value: number; currency: string | null };

export async function queryDailyMetrics(companyId: string, providers: AnalyticsProvider[], range: DateRange): Promise<StoredDailyMetric[]> {
  if (!providers.length) return [];
  const providerFilter = `provider=in.(${providers.join(",")})`;
  return supabaseRest<StoredDailyMetric[]>(
    `analytics_daily_metrics?company_id=eq.${encodeURIComponent(companyId)}&${providerFilter}&metric_date=gte.${range.startDate}&metric_date=lte.${range.endDate}&select=provider,asset_id,metric_date,metric_key,metric_value,currency&order=metric_date.asc`
  ).catch(() => []);
}

export type StoredContentMetric = {
  id: string;
  provider: AnalyticsProvider;
  asset_id: string;
  content_id: string;
  content_type: string | null;
  caption: string | null;
  title: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  metrics: Record<string, number | null>;
};

export async function queryContentMetrics(companyId: string, providers: AnalyticsProvider[], range: DateRange, limit = 50): Promise<StoredContentMetric[]> {
  if (!providers.length) return [];
  const providerFilter = `provider=in.(${providers.join(",")})`;
  return supabaseRest<StoredContentMetric[]>(
    `analytics_content_metrics?company_id=eq.${encodeURIComponent(companyId)}&${providerFilter}&published_at=gte.${range.startDate}T00:00:00Z&published_at=lte.${range.endDate}T23:59:59Z&select=*&order=published_at.desc&limit=${limit}`
  ).catch(() => []);
}

// Whether the migration creating these tables has been applied yet — every
// route that touches them checks this first so an un-migrated environment
// degrades to an honest "kurulum gerekli" state instead of a raw 404/500.
export async function analyticsTablesReady(): Promise<boolean> {
  try {
    const response = await supabaseRest<any[]>("analytics_daily_metrics?select=id&limit=1");
    return Array.isArray(response);
  } catch {
    return false;
  }
}

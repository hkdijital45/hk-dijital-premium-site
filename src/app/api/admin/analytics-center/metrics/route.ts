import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getAllProviderKpis } from "@/lib/analytics-center/kpi";
import { queryDailyMetrics } from "@/lib/analytics-center/metrics-store";
import { analyticsTablesReady } from "@/lib/analytics-center/metrics-store";
import { ANALYTICS_PROVIDERS } from "@/lib/analytics-center/types";
import { isCampaignMetricKey } from "@/lib/analytics-center/providers/google-ads";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import type { AnalyticsProvider } from "@/lib/analytics-center/types";

export async function GET(request: Request) {
  const session = await requireModuleAccess("analiz-raporlama");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  if (!(await analyticsTablesReady())) {
    return NextResponse.json({ tablesReady: false, kpis: {}, trend: [] });
  }

  const providersParam = url.searchParams.get("providers");
  const providers: AnalyticsProvider[] = providersParam
    ? providersParam.split(",").filter((p): p is AnalyticsProvider => ANALYTICS_PROVIDERS.includes(p as AnalyticsProvider))
    : ANALYTICS_PROVIDERS;

  const startDate = url.searchParams.get("startDate") || new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const endDate = url.searchParams.get("endDate") || new Date().toISOString().slice(0, 10);
  const range = { startDate, endDate };

  const [kpis, rawDaily] = await Promise.all([
    getAllProviderKpis(companyId, providers, range),
    queryDailyMetrics(companyId, providers, range)
  ]);

  // A compact per-day trend series for charts — one representative metric
  // per provider (the primary "awareness"/"ads" metric) rather than every
  // metric, to keep the payload small; the UI can request a narrower
  // provider list if it wants a focused single-metric trend.
  const primaryMetricByProvider: Record<AnalyticsProvider, string> = {
    instagram: "reach",
    facebook: "page_impressions_unique",
    youtube: "views",
    google_ads: "cost",
    google_business_profile: "BUSINESS_IMPRESSIONS_MOBILE_SEARCH"
  };
  const trendPoints = rawDaily.filter((row) => !isCampaignMetricKey(row.metric_key) && row.metric_key === primaryMetricByProvider[row.provider]);
  const trendByDate = new Map<string, Record<string, number>>();
  for (const point of trendPoints) {
    const entry = trendByDate.get(point.metric_date) || {};
    entry[point.provider] = (entry[point.provider] || 0) + point.metric_value;
    trendByDate.set(point.metric_date, entry);
  }
  const trend = [...trendByDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, ...values }));

  return NextResponse.json({ tablesReady: true, kpis, trend });
}

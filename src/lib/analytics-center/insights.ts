import "server-only";
import { PROVIDER_LABELS } from "./capabilities";
import type { AnalyticsProvider, KpiCardValue } from "./types";
import type { StoredContentMetric } from "./metrics-store";

// Deterministic, rule-based insight generation — no AI call, no per-report
// spend, per the product requirement that ordinary report generation must
// work at zero LLM/API cost beyond the platform APIs already being synced.
// Every sentence is derived directly from real fetched numbers; nothing
// here is invented.

function formatPercent(value: number) {
  return `%${Math.abs(Math.round(value))}`;
}

function formatValue(value: number, unit: KpiCardValue["unit"]) {
  if (unit === "currency") return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`;
  if (unit === "percent") return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`;
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export function buildProviderInsights(provider: AnalyticsProvider, kpis: KpiCardValue[]): string[] {
  const label = PROVIDER_LABELS[provider];
  const sentences: string[] = [];
  const meaningful = kpis.filter((k) => k.changePercent !== null && Math.abs(k.changePercent) >= 5 && k.value !== null);
  const sorted = [...meaningful].sort((a, b) => Math.abs(b.changePercent!) - Math.abs(a.changePercent!)).slice(0, 3);
  for (const kpi of sorted) {
    const direction = kpi.changePercent! >= 0 ? "arttı" : "azaldı";
    sentences.push(`${label} ${kpi.label.toLocaleLowerCase("tr-TR")} önceki döneme göre ${formatPercent(kpi.changePercent!)} ${direction} (${formatValue(kpi.value!, kpi.unit)}).`);
  }
  if (!sentences.length && kpis.some((k) => k.value !== null)) {
    sentences.push(`${label} performansı önceki döneme göre belirgin bir değişim göstermedi.`);
  }
  return sentences;
}

export function buildGoogleAdsInsights(kpis: KpiCardValue[]): string[] {
  const sentences: string[] = [];
  const cost = kpis.find((k) => k.key === "cost");
  const conversions = kpis.find((k) => k.key === "conversions");
  const costPerConversion = kpis.find((k) => k.key === "costPerConversion");
  if (costPerConversion?.changePercent !== null && costPerConversion?.changePercent !== undefined && Math.abs(costPerConversion.changePercent) >= 5) {
    const direction = costPerConversion.changePercent < 0 ? "azaldı" : "arttı";
    sentences.push(`Google Ads dönüşüm başı maliyet önceki döneme göre ${formatPercent(costPerConversion.changePercent)} ${direction}.`);
  }
  if (cost?.value && conversions?.value === 0) {
    sentences.push(`Google Ads üzerinde ${formatValue(cost.value, "currency")} harcama yapıldı ancak seçili dönemde dönüşüm kaydedilmedi.`);
  }
  return sentences;
}

export function buildGoogleBusinessInsights(kpis: KpiCardValue[]): string[] {
  const sentences: string[] = [];
  const calls = kpis.find((k) => k.key === "CALL_CLICKS");
  const directions = kpis.find((k) => k.key === "BUSINESS_DIRECTION_REQUESTS");
  if (calls?.value) sentences.push(`Google Business Profile üzerinden seçili dönemde ${formatValue(calls.value, "count")} telefon araması gerçekleşti.`);
  if (directions?.value) sentences.push(`${formatValue(directions.value, "count")} kez yol tarifi istendi.`);
  return sentences;
}

export function topContentInsight(contentByProvider: Partial<Record<AnalyticsProvider, StoredContentMetric[]>>): string | null {
  let best: { provider: AnalyticsProvider; item: StoredContentMetric; score: number } | null = null;
  for (const [provider, items] of Object.entries(contentByProvider) as Array<[AnalyticsProvider, StoredContentMetric[]]>) {
    for (const item of items || []) {
      const score = Object.values(item.metrics || {}).reduce((sum: number, v) => sum + (typeof v === "number" ? v : 0), 0);
      if (!best || score > best.score) best = { provider, item, score };
    }
  }
  if (!best) return null;
  const label = best.item.title || best.item.caption?.slice(0, 60) || "İçerik";
  return `Dönemin en yüksek etkileşim alan içeriği ${PROVIDER_LABELS[best.provider]} üzerinde yayınlanan "${label}" oldu.`;
}

export function strongestAndWeakestPlatform(kpisByProvider: Partial<Record<AnalyticsProvider, KpiCardValue[]>>): { strongest: AnalyticsProvider | null; weakest: AnalyticsProvider | null } {
  const averages = Object.entries(kpisByProvider).map(([provider, kpis]) => {
    const withChange = (kpis || []).filter((k) => k.changePercent !== null);
    const avg = withChange.length ? withChange.reduce((sum, k) => sum + k.changePercent!, 0) / withChange.length : null;
    return { provider: provider as AnalyticsProvider, avg };
  }).filter((entry) => entry.avg !== null);
  if (!averages.length) return { strongest: null, weakest: null };
  const sorted = [...averages].sort((a, b) => (b.avg! - a.avg!));
  return { strongest: sorted[0].provider, weakest: sorted[sorted.length - 1].provider };
}

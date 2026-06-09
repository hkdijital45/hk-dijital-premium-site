"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, Download, Filter, Sparkles } from "lucide-react";
import {
  aggregateCustomerReports,
  buildTrendRows,
  comparisonPercent,
  customerDateRangeOptions,
  customerMetricDefinitions,
  customerPlatformOptions,
  type CustomerDateRangeKey,
  type CustomerPlatformFilter,
  filterUpdatesForRange,
  filteredReportsForPeriod,
  formatCustomerMetricValue,
  getCustomerDateRange,
  getPreviousDateRange,
  platformFilterLabel
} from "@/lib/reports/customer-period";
import { reportHighlights } from "@/lib/reports/report-metrics";
import { CustomerMetricBox } from "./reports/CustomerMetricBox";
import { CustomerReportCharts } from "./reports/CustomerReportCharts";
import { CustomerAgencyNotes } from "./reports/CustomerAgencyNotes";
import { CustomerReportDashboardSummary } from "./reports/CustomerReportDashboardSummary";

const groups = [
  "Meta Reklam Raporu",
  "Google Ads Raporu",
  "Sosyal Medya Yönetimi Raporu",
  "Genel Dijital Performans Raporu"
];

function summary(report: any) {
  const value = report.metrics || {};
  if (report.report_type === "Sosyal Medya Yönetimi Raporu") return `${value.reach || 0} erişim · ${value.conversions || value.messages || 0} dönüşüm · ${value.spent || 0} TL harcama`;
  if (report.report_type === "Google Ads Raporu") return `${value.impressions || 0} gösterim · ${value.clicks || 0} tıklama · ${value.conversions || 0} dönüşüm`;
  return `${value.impressions || 0} gösterim · ${value.clicks || 0} tıklama · ${value.conversions || 0} dönüşüm`;
}

function aiMeta(item: any = {}) {
  const provider = item.provider || "Demo Modu";
  const model = item.model || item.ai_model || "demo-local";
  const mode = item.mode || (String(provider).toLocaleLowerCase("tr").includes("demo") ? "Demo" : "Canlı");
  return { provider, model, mode, badge: item.badge || `${provider} ile üretildi` };
}

function comparisonTone(value: number) {
  if (value > 0) return "positive" as const;
  if (value < 0) return "negative" as const;
  return "neutral" as const;
}

function exportHref(reportId: string, format: string, range: ReturnType<typeof getCustomerDateRange>, platform: CustomerPlatformFilter) {
  const params = new URLSearchParams({
    format,
    start: range.start,
    end: range.end,
    platform,
    rangeLabel: range.label
  });
  return `/api/customer/reports/${reportId}/export?${params.toString()}`;
}

export function CustomerReports({ reports, initialInterpretations, reportUpdates }: { reports: any[]; initialInterpretations: any[]; reportUpdates: any[] }) {
  const [interpretations, setInterpretations] = useState(initialInterpretations || []);
  const [periodInterpretation, setPeriodInterpretation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rangeKey, setRangeKey] = useState<CustomerDateRangeKey>("last_30");
  const [platform, setPlatform] = useState<CustomerPlatformFilter>("all");
  const [customStart, setCustomStart] = useState(() => getCustomerDateRange("last_30").start);
  const [customEnd, setCustomEnd] = useState(() => getCustomerDateRange("last_30").end);
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    rangeKey: "last_30" as CustomerDateRangeKey,
    platform: "all" as CustomerPlatformFilter,
    customStart: getCustomerDateRange("last_30").start,
    customEnd: getCustomerDateRange("last_30").end
  }));

  const selectedRange = useMemo(() => getCustomerDateRange(rangeKey, customStart, customEnd), [rangeKey, customStart, customEnd]);
  const range = useMemo(() => getCustomerDateRange(appliedFilters.rangeKey, appliedFilters.customStart, appliedFilters.customEnd), [appliedFilters]);
  const appliedPlatform = appliedFilters.platform;
  const previousRange = useMemo(() => getPreviousDateRange(range), [range]);
  const filteredReports = useMemo(() => filteredReportsForPeriod(reports, range, appliedPlatform), [reports, range, appliedPlatform]);
  const currentAggregate = useMemo(() => aggregateCustomerReports(reports, range, appliedPlatform), [reports, range, appliedPlatform]);
  const previousAggregate = useMemo(() => aggregateCustomerReports(reports, previousRange, appliedPlatform), [reports, previousRange, appliedPlatform]);
  const trendRows = useMemo(() => buildTrendRows(reports, range, appliedPlatform), [reports, range, appliedPlatform]);
  const periodUpdates = useMemo(() => filterUpdatesForRange(reportUpdates || [], range, filteredReports.map((report) => report.id)), [reportUpdates, range, filteredReports]);

  useEffect(() => {
    reports.forEach((report) => {
      fetch("/api/customer/reports/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: report.id }) }).catch(() => undefined);
    });
  }, [reports]);

  async function interpretPeriod() {
    if (!filteredReports.length) {
      setError("Bu tarih aralığında yorumlanacak rapor verisi bulunamadı.");
      return;
    }
    setLoading(true);
    setError("");
    const response = await fetch("/api/customer/reports/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportIds: filteredReports.map((report) => report.id),
        filters: {
          start: range.start,
          end: range.end,
          label: range.label,
          platform: appliedPlatform,
          platformLabel: platformFilterLabel(appliedPlatform)
        }
      })
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      setPeriodInterpretation(data.interpretation);
      setInterpretations((current) => [data.interpretation, ...current]);
    } else {
      setError(data.error || "Rapor yorumlanamadı. Lütfen daha sonra yeniden deneyin.");
    }
    setLoading(false);
  }

  function applyFilters() {
    const nextRange = getCustomerDateRange(rangeKey, customStart, customEnd);
    if (process.env.NODE_ENV === "development") {
      console.debug("[customer-reports] date filter selected range", {
        start: nextRange.start,
        end: nextRange.end,
        label: nextRange.label,
        platform
      });
    }
    setAppliedFilters({ rangeKey, platform, customStart, customEnd });
    setError("");
  }

  if (!reports.length) return null;

  const hasData = filteredReports.length > 0 && trendRows.length > 0;
  const periodMeta = periodInterpretation ? aiMeta(periodInterpretation) : null;

  return (
    <section className="glass-card mt-8 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black"><BarChart3 className="text-cyan-200" /> Raporlarım</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Tarih aralığı ve platform seçerek performansınızı sade metrikler, karşılaştırmalar ve yapay zekâ yorumlarıyla inceleyebilirsiniz.</p>
        </div>
        <button disabled={loading || !filteredReports.length} onClick={interpretPeriod} className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-xs font-black text-slate-950 shadow-[0_14px_40px_rgba(103,232,249,.24)] disabled:opacity-60">
          <Sparkles size={15} /> {loading ? "Yorumlanıyor..." : "AI Yorumla"}
        </button>
      </div>

      <CustomerReportDashboardSummary reports={reports} />

      <div className="mt-6 rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-cyan-100"><CalendarDays size={16} /> Tarih aralığı</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {customerDateRangeOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setRangeKey(option.key)}
                  className={`rounded-full border px-3 py-2 text-xs font-black transition ${rangeKey === option.key ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-cyan-200/40"}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {rangeKey === "custom" && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-300">
                  Başlangıç Tarihi
                  <input value={customStart} onChange={(event) => setCustomStart(event.target.value)} type="date" className="mt-2 w-full rounded-[8px] border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/60" />
                </label>
                <label className="text-xs font-bold text-slate-300">
                  Bitiş Tarihi
                  <input value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} type="date" className="mt-2 w-full rounded-[8px] border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/60" />
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-black text-cyan-100"><Filter size={16} /> Platform</label>
            <select value={platform} onChange={(event) => setPlatform(event.target.value as CustomerPlatformFilter)} className="mt-3 w-full rounded-[8px] border border-white/10 bg-slate-950/70 px-3 py-3 text-sm font-bold text-white outline-none focus:border-cyan-200/60">
              {customerPlatformOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
            <button type="button" onClick={applyFilters} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-xs font-black text-slate-950 shadow-[0_14px_40px_rgba(103,232,249,.18)]">
              <Filter size={15} /> Raporları Listele
            </button>
            <p className="mt-3 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-xs leading-5 text-cyan-50">Seçilen tarih aralığı: <strong>{selectedRange.label}</strong><br />Listelenen tarih aralığı: <strong>{range.label}</strong><br />Platform: <strong>{platformFilterLabel(appliedPlatform)}</strong></p>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 rounded-[8px] border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}

      {!hasData ? (
        <div className="mt-6 rounded-[8px] border border-white/10 bg-white/[0.04] p-6 text-center">
          <p className="text-lg font-black text-white">Bu tarih aralığında rapor verisi bulunamadı.</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">Farklı bir tarih aralığı veya platform seçerek tekrar deneyebilirsiniz.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {customerMetricDefinitions.map((metric) => {
              const current = Number(currentAggregate.metrics?.[metric.key] || 0);
              const previous = Number(previousAggregate.metrics?.[metric.key] || 0);
              const percent = comparisonPercent(current, previous);
              const sign = percent > 0 ? "+" : "";
              return (
                <CustomerMetricBox
                  key={metric.key}
                  label={metric.label}
                  value={formatCustomerMetricValue(metric.key, current)}
                  explanation={metric.explanation}
                  comparisonLabel={`Önceki döneme göre ${sign}%${Math.abs(percent).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`}
                  comparisonTone={comparisonTone(percent)}
                />
              );
            })}
          </div>

          <div className="mt-6 rounded-[8px] border border-white/10 bg-black/20 p-4">
            <h3 className="font-black text-cyan-100">Performans trendi</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">Seçilen döneme göre günlük veya haftalık trendler gösterilir.</p>
            <div className="mt-4"><CustomerReportCharts rows={trendRows} /></div>
          </div>

          <div className="mt-6 rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
            <h3 className="font-black text-cyan-100">Ajans Notu</h3>
            <p className="mt-1 text-sm leading-6 text-slate-400">Seçilen dönem için ajans tarafından paylaşılan müşteri notları.</p>
            <div className="mt-4"><CustomerAgencyNotes notes={periodUpdates} /></div>
          </div>

          {periodInterpretation && periodMeta && (
            <div className="mt-6 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-4 text-sm leading-6 text-cyan-50">
              <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[.1em]">
                <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-cyan-100">{periodMeta.badge}</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Kullanılan AI Sağlayıcısı: {periodMeta.provider}</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Model: {periodMeta.model}</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Mod: {periodMeta.mode}</span>
              </div>
              <p className="font-black">Kullanılan tarih aralığı: {range.label} · Platform: {platformFilterLabel(appliedPlatform)}</p>
              <p className="mt-3 whitespace-pre-line">{periodInterpretation.interpretation_text}</p>
            </div>
          )}
        </>
      )}

      <div className="mt-7 grid gap-7">
        {groups.map((group) => {
          const items = filteredReports.filter((report) => report.report_type === group);
          if (!items.length) return null;
          return (
            <div key={group}>
              <h3 className="font-black text-cyan-100">{group.replace("Raporu", "Raporları")}</h3>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {items.map((report) => {
                  const history = interpretations.filter((item) => item.report_id === report.id);
                  const notes = filterUpdatesForRange(reportUpdates || [], range, [report.id]);
                  return (
                    <article key={report.id} className="rounded-[8px] border border-white/10 bg-black/25 p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/30">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-200">{report.report_type}</p>
                          <h4 className="mt-2 text-lg font-black">{range.label}</h4>
                          <p className="mt-1 text-xs font-bold text-slate-400">{platformFilterLabel(appliedPlatform)}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-bold text-slate-200">{summary(report)}</p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">{reportHighlights(report).map((metric) => <CustomerMetricBox key={metric.key} label={metric.label} value={metric.value} explanation={metric.explanation} />)}</div>
                      {report.customer_note && <p className="mt-4 text-sm leading-6 text-slate-300">Ajans notu: {report.customer_note}</p>}
                      {history.map((item) => {
                        const meta = aiMeta(item);
                        return (
                          <div key={item.id} className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm leading-6 text-cyan-50">
                            <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[.1em]">
                              <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-cyan-100">{meta.badge}</span>
                              <span className="rounded-full border border-white/10 px-3 py-1 text-cyan-50">Kullanılan AI Sağlayıcısı: {meta.provider}</span>
                              <span className="rounded-full border border-white/10 px-3 py-1 text-cyan-50">Model: {meta.model}</span>
                              <span className="rounded-full border border-white/10 px-3 py-1 text-cyan-50">Mod: {meta.mode}</span>
                            </div>
                            <p>{item.interpretation_text}</p>
                            <p className="mt-2 text-xs text-cyan-100/70">{new Date(item.created_at).toLocaleString("tr-TR")}</p>
                          </div>
                        );
                      })}
                      <details className="mt-4 rounded-[8px] border border-white/10 p-3">
                        <summary className="cursor-pointer text-sm font-black text-cyan-100">Grafikler</summary>
                        <div className="mt-4"><CustomerReportCharts rows={buildTrendRows([report], range, appliedPlatform)} /></div>
                      </details>
                      <details className="mt-3 rounded-[8px] border border-white/10 p-3">
                        <summary className="cursor-pointer text-sm font-black text-cyan-100">Ajans notları</summary>
                        <div className="mt-4"><CustomerAgencyNotes notes={notes} /></div>
                      </details>
                      <details className="mt-3 rounded-[8px] border border-white/10 p-3">
                        <summary className="cursor-pointer text-sm font-black text-cyan-100">Rapor indir</summary>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[["excel", "Excel indir"], ["word", "Word indir"], ["pdf", "PDF indir"]].map(([format, label]) => (
                            <a key={format} href={exportHref(report.id, format, range, appliedPlatform)} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-white hover:border-cyan-200/40">
                              <Download size={13} /> {label}
                            </a>
                          ))}
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

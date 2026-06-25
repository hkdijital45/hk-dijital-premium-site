"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

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
import {
  buildActionPlan,
  calculateHKIntelligenceScore,
  calculateHealthScore,
  calculateRoasRoi,
  formatCurrency,
  formatNumber,
  getCompetitorEntries,
  getCreativeItems,
  getLeadTracking,
  getWorkLogItems
} from "@/lib/reports/report-insights";

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

function scoreTone(score: number) {
  if (score >= 85) return "border-emerald-300/30 bg-emerald-400/15 text-emerald-100";
  if (score >= 70) return "border-cyan-300/30 bg-cyan-400/15 text-cyan-100";
  if (score >= 40) return "border-amber-300/30 bg-amber-400/15 text-amber-100";
  return "border-rose-300/30 bg-rose-400/15 text-rose-100";
}

function exportHref(reportId: string, format: string, range: ReturnType<typeof getCustomerDateRange>, platform: CustomerPlatformFilter, viewMode = "executive") {
  const params = new URLSearchParams({
    format,
    start: range.start,
    end: range.end,
    platform,
    rangeLabel: range.label,
    viewMode
  });
  return `/api/customer/reports/${reportId}/export?${params.toString()}`;
}

const metricVisibilityAliases: Record<string, string> = {
  spent: "spend",
  average_cpc: "cpc",
  cost_per_conversion: "cost_per_lead",
  conversions: "leads",
  link_clicks: "clicks"
};

export function CustomerReports({ reports, initialInterpretations, reportUpdates, visibilityRules = [] }: { reports: any[]; initialInterpretations: any[]; reportUpdates: any[]; visibilityRules?: any[] }) {
  const [viewMode, setViewMode] = useState<"basic" | "premium" | "executive">("executive");
  const [interpretations, setInterpretations] = useState(initialInterpretations || []);
  const [periodInterpretation, setPeriodInterpretation] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState("");
  const [error, setError] = useState("");
  const [reportErrors, setReportErrors] = useState<Record<string, string>>({});
  const [rangeKey, setRangeKey] = useState<CustomerDateRangeKey>("last_30");
  const [platform, setPlatform] = useState<CustomerPlatformFilter>("all");
  const [customStart, setCustomStart] = useState(() => getCustomerDateRange("last_30").start);
  const [customEnd, setCustomEnd] = useState(() => getCustomerDateRange("last_30").end);
  const [roiInput, setRoiInput] = useState({ salesCount: "", revenue: "", averageOrderValue: "", serviceFee: "" });
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

  async function interpretSingleReport(report: any) {
    setReportLoading(report.id);
    setReportErrors((current) => ({ ...current, [report.id]: "" }));
    const response = await fetch("/api/customer/reports/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportIds: [report.id],
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
      setInterpretations((current) => [data.interpretation, ...current]);
    } else {
      setReportErrors((current) => ({ ...current, [report.id]: data.error || "Rapor yorumlanamadı. Lütfen daha sonra yeniden deneyin." }));
    }
    setReportLoading("");
  }

  function applyFilters() {
    setAppliedFilters({ rangeKey, platform, customStart, customEnd });
    setError("");
  }

  if (!reports.length) return null;

  const hasData = filteredReports.length > 0 && trendRows.length > 0;
  const periodMeta = periodInterpretation ? aiMeta(periodInterpretation) : null;
  const overviewHealth = calculateHealthScore(currentAggregate);
  const overviewIntelligence = calculateHKIntelligenceScore(currentAggregate, periodUpdates);
  const overviewPlan = buildActionPlan(currentAggregate, periodUpdates);
  const overviewLeads = getLeadTracking(currentAggregate);
  const executiveText = `Merhaba,\n\n${range.label} reklam çalışmalarınızın özetini paylaşmak isteriz.\n\n• ${formatNumber(overviewLeads.total)} kişi iletişime geçti\n• ${formatNumber(overviewLeads.proposed)} teklif sürecine ilerledi\n• ${formatNumber(overviewLeads.sold)} satış kaydı oluştu\n\nBu süreçte toplam ${formatCurrency(currentAggregate.metrics?.spent || 0)} reklam harcaması yapıldı.\n\nPerformans düzenli olarak izleniyor. Daha fazla dönüşüm için güçlü reklam gruplarına kontrollü bütçe aktarımı değerlendirilebilir.\n\nSatış garantisi değil, ölçülebilir büyüme sistemi.\n\nHK Dijital`;
  const executiveWhatsapp = `https://wa.me/?text=${encodeURIComponent(executiveText)}`;
  const roi = calculateRoasRoi({ adSpend: currentAggregate.metrics?.spent, ...roiInput });
  const canShowMetric = (key: string) => {
    const metricKey = metricVisibilityAliases[key] || key;
    const rule = visibilityRules.find((item) => item.section_key === "metrics" && item.metric_key === metricKey);
    return rule?.is_visible ?? true;
  };

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

      <div className="mt-5 rounded-[18px] border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-black">Akıllı Rapor Görünümü</h3><p className="mt-1 text-sm text-slate-600">Sonuç odaklı Executive, sade Basic veya metrik odaklı Premium görünümü seçin.</p></div>
          <div className="flex flex-wrap gap-2">{[["executive", "Executive Rapor"], ["basic", "Basic Rapor"], ["premium", "Premium Rapor"]].map(([key, label]) => <button key={key} onClick={() => setViewMode(key as "basic" | "premium" | "executive")} className={`rounded-full px-4 py-2 text-xs font-black ${viewMode === key ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-700"}`}>{label}</button>)}</div>
        </div>
        {viewMode === "executive" && <div className="mt-4 rounded-[14px] bg-slate-50 p-4"><pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-700">{executiveText}</pre><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(executiveText)} className="rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white">Kopyala</button><a href={executiveWhatsapp} target="_blank" rel="noreferrer" className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white">WhatsApp&apos;a Gönder</a><button disabled={loading} onClick={interpretPeriod} className="rounded-full bg-purple-600 px-4 py-2 text-xs font-black text-white">{loading ? "Hazırlanıyor..." : "AI Rapor Hazırla"}</button></div></div>}
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
            {customerMetricDefinitions.filter((metric) => canShowMetric(metric.key)).map((metric) => {
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

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-cyan-100">Reklam Sağlık Skoru</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{overviewHealth.explanation}</p>
                </div>
                <span className={`rounded-full border px-4 py-2 text-sm font-black ${scoreTone(overviewHealth.score)}`}>{overviewHealth.score}/100 · {overviewHealth.label}</span>
              </div>
              <div className="mt-4 grid gap-2">{overviewHealth.dimensions.map((item) => <div key={item.label} className="rounded-[8px] border border-white/10 bg-black/20 p-3"><div className="flex justify-between gap-3 text-sm"><strong>{item.label}</strong><span>{item.score === null ? "Veri yok" : `${item.score}/100 · ${item.status}`}</span></div><p className="mt-1 text-xs leading-5 text-slate-400">{item.explanation}</p></div>)}</div>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-cyan-100">HK Intelligence Skoru</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">Reklam, sosyal, dönüşüm ve ajans çalışma düzenini birlikte okuyan marka içi değerlendirme skorudur.</p>
                </div>
                <span className={`rounded-full border px-4 py-2 text-sm font-black ${scoreTone(overviewIntelligence.score)}`}>{overviewIntelligence.score}/100 · {overviewIntelligence.label}</span>
              </div>
              <div className="mt-4 grid gap-2">{overviewIntelligence.dimensions.map((item) => <div key={item.label} className="rounded-[8px] border border-white/10 bg-black/20 p-3"><div className="flex justify-between gap-3 text-sm"><strong>{item.label}</strong><span>{item.score === null ? "Veri yok" : `${item.score}/100`}</span></div><p className="mt-1 text-xs leading-5 text-slate-400">{item.explanation}</p></div>)}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
              <h3 className="font-black text-cyan-100">ROAS / ROI Hesaplayıcı</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">ROAS (Reklam Harcaması Getirisi) ve ROI (Yatırım Getirisi) için satış verilerinizi geçici olarak girin. Bu bilgiler kaydedilmez.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold text-slate-300">Reklam harcaması<input readOnly value={formatCurrency(roi.adSpend)} className="mt-2 w-full rounded-[8px] border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300" /></label>
                {(["salesCount", "revenue", "averageOrderValue", "serviceFee"] as const).map((key) => <label key={key} className="text-xs font-bold text-slate-300">{key === "salesCount" ? "Gelen satış adedi" : key === "revenue" ? "Toplam ciro" : key === "averageOrderValue" ? "Ortalama sepet tutarı" : "Hizmet bedeli (opsiyonel)"}<input value={roiInput[key]} onChange={(event) => setRoiInput({ ...roiInput, [key]: event.target.value })} className="mt-2 w-full rounded-[8px] border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/60" /></label>)}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <CustomerMetricBox label="ROAS" value={`${formatNumber(roi.roas, 2)}x`} explanation="Reklam harcamasının kaç katı ciro oluştuğunu gösterir." />
                <CustomerMetricBox label="ROI" value={`%${formatNumber(roi.roi, 1)}`} explanation="Hizmet bedeli dahil toplam maliyete göre getiriyi gösterir." />
                <CustomerMetricBox label="Satış başı maliyet" value={formatCurrency(roi.costPerSale)} explanation="Her satış için ortalama maliyettir." />
              </div>
              <p className="mt-3 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm leading-6 text-cyan-50">{roi.text}</p>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
              <h3 className="font-black text-cyan-100">WhatsApp / Lead Takibi</h3>
              <p className="mt-1 text-sm leading-6 text-slate-400">Kişisel veriler gösterilmeden toplam lead durumları özetlenir.</p>
              <div className="mt-4 grid gap-2">{[
                ["Toplam lead", overviewLeads.total],
                ["Arandı", overviewLeads.called],
                ["Teklif verildi", overviewLeads.proposed],
                ["Satış oldu", overviewLeads.sold],
                ["Takip bekliyor", overviewLeads.pending]
              ].map(([label, value]) => <div key={label} className="flex items-center justify-between rounded-[8px] border border-white/10 bg-black/20 p-3 text-sm"><span>{label}</span><strong>{formatNumber(Number(value))}</strong></div>)}</div>
            </div>
          </div>

          <div className="mt-6 rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
            <h3 className="font-black text-cyan-100">Önümüzdeki 7 Gün Planı</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">{overviewPlan.map((item, index) => <div key={item} className="rounded-[8px] border border-white/10 bg-black/20 p-3 text-sm leading-6 text-slate-200"><strong className="text-cyan-100">{index + 1}.</strong> {item}</div>)}</div>
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
                  const health = calculateHealthScore(report);
                  const intelligence = calculateHKIntelligenceScore(report, notes);
                  const actionPlan = buildActionPlan(report, notes);
                  const competitors = getCompetitorEntries(report);
                  const creatives = getCreativeItems(report);
                  const workLog = getWorkLogItems(notes);
                  const leadTracking = getLeadTracking(report);
                  return (
                    <article key={report.id} className="rounded-[8px] border border-white/10 bg-black/25 p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/30">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-200">{report.report_type}</p>
                          <h4 className="mt-2 text-lg font-black">{range.label}</h4>
                          <p className="mt-1 text-xs font-bold text-slate-400">{platformFilterLabel(appliedPlatform)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button disabled={reportLoading === report.id} onClick={() => interpretSingleReport(report)} className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60"><Sparkles size={13} /> {reportLoading === report.id ? "Yorumlanıyor..." : "AI Yorumla"}</button>
                          <a href={exportHref(report.id, "pdf", range, appliedPlatform, viewMode)} className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 px-4 py-2 text-xs font-black text-cyan-100"><Download size={13} /> {viewMode === "basic" ? "Basic PDF" : viewMode === "premium" ? "Premium PDF" : "Executive PDF"}</a>
                        </div>
                      </div>
                      <p className="mt-3 text-sm font-bold text-slate-200">{summary(report)}</p>
                      {reportErrors[report.id] && <p className="mt-3 rounded-[8px] border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">{reportErrors[report.id]}</p>}
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3"><div className="flex justify-between gap-3"><strong className="text-cyan-100">Reklam Sağlık Skoru</strong><span className={`rounded-full border px-3 py-1 text-xs font-black ${scoreTone(health.score)}`}>{health.score}/100 · {health.label}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">{health.explanation}</p></div>
                        <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3"><div className="flex justify-between gap-3"><strong className="text-cyan-100">HK Intelligence Skoru</strong><span className={`rounded-full border px-3 py-1 text-xs font-black ${scoreTone(intelligence.score)}`}>{intelligence.score}/100 · {intelligence.label}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">Reklam, sosyal/dönüşüm ve ajans aktivitesi birlikte değerlendirilir.</p></div>
                      </div>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">{reportHighlights(report).filter((metric) => canShowMetric(metric.key)).map((metric) => <CustomerMetricBox key={metric.key} label={metric.label} value={metric.value} explanation={metric.explanation} />)}</div>
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
                        <summary className="cursor-pointer text-sm font-black text-cyan-100">Günlük / dönem grafikleri</summary>
                        <div className="mt-4"><CustomerReportCharts rows={buildTrendRows([report], range, appliedPlatform)} /></div>
                      </details>
                      <details className="mt-3 rounded-[8px] border border-white/10 p-3" open>
                        <summary className="cursor-pointer text-sm font-black text-cyan-100">Önümüzdeki 7 Gün Planı</summary>
                        <div className="mt-3 grid gap-2">{actionPlan.map((item, index) => <p key={item} className="rounded-[8px] bg-white/[0.04] p-3 text-sm leading-6 text-slate-200"><strong className="text-cyan-100">{index + 1}.</strong> {item}</p>)}</div>
                      </details>
                      <details className="mt-3 rounded-[8px] border border-white/10 p-3">
                        <summary className="cursor-pointer text-sm font-black text-cyan-100">Ajans Çalışma Günlüğü</summary>
                        <div className="mt-3 grid gap-3">{workLog.length ? workLog.map((item) => <div key={item.id || `${item.date}-${item.title}`} className="rounded-[8px] bg-white/[0.04] p-3 text-sm"><p className="font-black text-white">{item.date ? new Date(item.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }) : "Tarih yok"} - {item.title}</p><p className="mt-1 text-xs text-cyan-100">{item.category} · {item.status}</p><p className="mt-2 leading-6 text-slate-300">{item.description || "Açıklama eklenmedi."}</p></div>) : <p className="text-sm text-slate-400">Bu dönem için çalışma günlüğü henüz eklenmedi.</p>}</div>
                      </details>
                      <details className="mt-3 rounded-[8px] border border-white/10 p-3">
                        <summary className="cursor-pointer text-sm font-black text-cyan-100">Rakip Analizi</summary>
                        <div className="mt-3 grid gap-3">{competitors.length ? competitors.map((item, index) => <div key={index} className="rounded-[8px] bg-white/[0.04] p-3 text-sm"><p className="font-black text-white">{item.name || item.competitor || "Rakip"}</p><p className="mt-1 text-xs text-slate-400">Aktif reklam: {item.activeAds ?? "Veri yok"} · Yeni reklam: {item.newAds ?? "Veri yok"} · Video: {item.videoAds ?? "Veri yok"} · Görsel: {item.imageAds ?? "Veri yok"}</p><p className="mt-2 leading-6 text-slate-300">{item.notes || "Not eklenmedi."}</p></div>) : <p className="text-sm text-slate-400">Rakip sinyali henüz manuel olarak eklenmedi.</p>}</div>
                      </details>
                      <details className="mt-3 rounded-[8px] border border-white/10 p-3">
                        <summary className="cursor-pointer text-sm font-black text-cyan-100">Kreatif Merkezi</summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">{creatives.length ? creatives.map((item, index) => <div key={index} className="rounded-[8px] bg-white/[0.04] p-3 text-sm">{item.imageUrl || item.url ? <img src={item.imageUrl || item.url} alt={item.caption || "Rapor kreatifi"} className="mb-3 aspect-video w-full rounded-[8px] object-cover" /> : null}<p className="font-black text-white">{item.type || "Kreatif"}</p><p className="mt-1 text-xs text-cyan-100">{item.platform || report.platform || "-"} · {item.dateUsed || item.date || "Tarih yok"}</p><p className="mt-2 leading-6 text-slate-300">{item.caption || item.note || "Açıklama eklenmedi."}</p></div>) : <p className="text-sm text-slate-400">Bu rapor dönemine ait kreatif henüz eklenmedi.</p>}</div>
                      </details>
                      <details className="mt-3 rounded-[8px] border border-white/10 p-3">
                        <summary className="cursor-pointer text-sm font-black text-cyan-100">WhatsApp / Lead Takibi</summary>
                        <div className="mt-3 grid gap-2 sm:grid-cols-5">{[["Toplam lead", leadTracking.total], ["Arandı", leadTracking.called], ["Teklif verildi", leadTracking.proposed], ["Satış oldu", leadTracking.sold], ["Takip bekliyor", leadTracking.pending]].map(([label, value]) => <div key={label} className="rounded-[8px] bg-white/[0.04] p-3 text-center"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-white">{formatNumber(Number(value))}</p></div>)}</div>
                      </details>
                      <details className="mt-3 rounded-[8px] border border-white/10 p-3">
                        <summary className="cursor-pointer text-sm font-black text-cyan-100">Ajans notları</summary>
                        <div className="mt-4"><CustomerAgencyNotes notes={notes} /></div>
                      </details>
                      <details className="mt-3 rounded-[8px] border border-white/10 p-3">
                        <summary className="cursor-pointer text-sm font-black text-cyan-100">Rapor indir</summary>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {[["excel", "Excel indir"], ["word", "Word indir"], ["pdf", "PDF indir"]].map(([format, label]) => (
                            <a key={format} href={exportHref(report.id, format, range, appliedPlatform, viewMode)} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-white hover:border-cyan-200/40">
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

"use client";

import { useEffect, useState } from "react";
import { BarChart3, Sparkles } from "lucide-react";
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
  if (report.report_type === "Sosyal Medya Yönetimi Raporu") return `${value.posts || 0} içerik · ${value.reach || 0} erişim · ${value.followers_growth || 0} yeni takipçi`;
  if (report.report_type === "Google Ads Raporu") return `${value.impressions || 0} gösterim · ${value.clicks || 0} tıklama · ${value.conversions || 0} dönüşüm`;
  return `${value.impressions || 0} gösterim · ${value.clicks || 0} tıklama · ${value.leads || value.messages || 0} potansiyel müşteri`;
}

function aiMeta(item: any = {}) {
  const provider = item.provider || "Demo Modu";
  const model = item.model || item.ai_model || "demo-local";
  const mode = item.mode || (String(provider).toLocaleLowerCase("tr").includes("demo") ? "Demo" : "Canlı");
  return { provider, model, mode, badge: item.badge || `${provider} ile üretildi` };
}

export function CustomerReports({ reports, initialInterpretations, reportUpdates }: { reports: any[]; initialInterpretations: any[]; reportUpdates: any[] }) {
  const [interpretations, setInterpretations] = useState(initialInterpretations || []);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    reports.forEach((report) => {
      fetch("/api/customer/reports/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId: report.id }) }).catch(() => undefined);
    });
  }, [reports]);

  async function interpret(reportId: string) {
    setLoading(reportId);
    setError("");
    const response = await fetch("/api/customer/reports/interpret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId }) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setInterpretations((current) => [data.interpretation, ...current]);
    else setError(data.error || "Rapor yorumlanamadı. Lütfen daha sonra yeniden deneyin.");
    setLoading("");
  }

  if (!reports.length) return null;
  return (
    <section className="glass-card mt-8 p-5">
      <h2 className="flex items-center gap-2 text-xl font-black"><BarChart3 className="text-cyan-200" /> Raporlarım</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Kanal bazlı performans özetlerinizi ve yapay zekâ destekli değerlendirmeleri burada inceleyebilirsiniz.</p>
      <CustomerReportDashboardSummary reports={reports} />
      {error && <p className="mt-4 rounded-[8px] border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</p>}
      <div className="mt-6 grid gap-7">
        {groups.map((group) => {
          const items = reports.filter((report) => report.report_type === group);
          if (!items.length) return null;
          return <div key={group}><h3 className="font-black text-cyan-100">{group.replace("Raporu", "Raporları")}</h3><div className="mt-3 grid gap-4 lg:grid-cols-2">{items.map((report) => {
            const history = interpretations.filter((item) => item.report_id === report.id);
            return <article key={report.id} className="rounded-[8px] border border-white/10 bg-black/25 p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-200/30">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-200">{report.report_type}</p><h4 className="mt-2 text-lg font-black">{report.period || "Güncel dönem"}</h4></div><button disabled={loading === report.id} onClick={() => interpret(report.id)} className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60"><Sparkles size={14} /> {loading === report.id ? "Yorumlanıyor..." : "Yorumla"}</button></div>
              <p className="mt-3 text-sm font-bold text-slate-200">{summary(report)}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">{reportHighlights(report).map((metric) => <CustomerMetricBox key={metric.key} label={metric.label} value={metric.value} explanation={metric.explanation} />)}</div>
              {report.customer_note && <p className="mt-4 text-sm leading-6 text-slate-300">Genel değerlendirme: {report.customer_note}</p>}
              {history.map((item) => { const meta = aiMeta(item); return <div key={item.id} className="mt-4 rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 p-3 text-sm leading-6 text-cyan-50"><div className="mb-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[.1em]"><span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-cyan-100">{meta.badge}</span><span className="rounded-full border border-white/10 px-3 py-1 text-cyan-50">Kullanılan AI Sağlayıcısı: {meta.provider}</span><span className="rounded-full border border-white/10 px-3 py-1 text-cyan-50">Model: {meta.model}</span><span className="rounded-full border border-white/10 px-3 py-1 text-cyan-50">Mod: {meta.mode}</span></div><p>{item.interpretation_text}</p><p className="mt-2 text-xs text-cyan-100/70">{new Date(item.created_at).toLocaleString("tr-TR")}</p></div>; })}
              <details className="mt-4 rounded-[8px] border border-white/10 p-3"><summary className="cursor-pointer text-sm font-black text-cyan-100">Grafikler</summary><div className="mt-4"><CustomerReportCharts rows={report.time_series || []} /></div></details>
              <details className="mt-3 rounded-[8px] border border-white/10 p-3"><summary className="cursor-pointer text-sm font-black text-cyan-100">Ajans notları</summary><div className="mt-4"><CustomerAgencyNotes notes={(reportUpdates || []).filter((item) => item.report_id === report.id)} /></div></details>
              <details className="mt-3 rounded-[8px] border border-white/10 p-3"><summary className="cursor-pointer text-sm font-black text-cyan-100">Rapor indir</summary><div className="mt-3 flex flex-wrap gap-2">{[["excel", "Excel indir"], ["word", "Word indir"], ["pdf", "PDF indir"]].map(([format, label]) => <a key={format} href={`/api/customer/reports/${report.id}/export?format=${format}`} className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-white">{label}</a>)}</div></details>
            </article>;
          })}</div></div>;
        })}
      </div>
    </section>
  );
}

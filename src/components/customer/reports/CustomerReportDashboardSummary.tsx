import { customerReportSummary } from "@/lib/reports/report-dashboard";

export function CustomerReportDashboardSummary({ reports }: { reports: any[] }) {
  const summary = customerReportSummary(reports);
  return <div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-[8px] bg-black/20 p-3"><p className="text-xs text-slate-400">Son rapor</p><p className="mt-1 font-black">{summary.latest?.period || "Henüz rapor yok"}</p></div><div className="rounded-[8px] bg-black/20 p-3"><p className="text-xs text-slate-400">Öne çıkan kanal</p><p className="mt-1 font-black">{summary.bestChannel}</p></div><div className="rounded-[8px] bg-black/20 p-3"><p className="text-xs text-slate-400">Sıradaki önerilen adım</p><p className="mt-1 text-sm leading-5 text-slate-200">{summary.nextAction}</p></div></div>;
}

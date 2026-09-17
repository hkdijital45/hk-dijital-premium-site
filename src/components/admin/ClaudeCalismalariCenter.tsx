"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ContentPlanningCenter.tsx */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";

type Company = { id: string; name: string };
type Run = {
  id: string;
  command_text: string;
  target_company_id: string | null;
  status: string;
  final_report: { activity_type?: string; sources?: string[]; summary?: string; findings?: string[]; hypotheses?: string[]; actions?: string[]; measurement_plan?: string[]; period_start?: string | null; period_end?: string | null };
  recommendation_summary: { count?: number };
  created_at: string;
};

export function ClaudeCalismalariCenter() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [openRun, setOpenRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/companies").then((r) => r.json()).then((body) => setCompanies(body.companies || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/hk-intelligence-ceo/claude-activity${companyId ? `?companyId=${companyId}` : ""}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Yüklenemedi.");
      setRuns(body.runs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const companyName = (id: string | null) => companies.find((c) => c.id === id)?.name || "—";

  return (
    <AdminWorkspace eyebrow="HK Intelligence" title="Claude Çalışmaları" description="Claude'un müşteriler için ürettiği analiz, strateji ve planların gerçek kaydı.">
      <div className="mb-5 relative w-fit">
        <p className="mb-1 text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Müşteri filtresi</p>
        <button type="button" onClick={() => setPickerOpen((v) => !v)} className="flex min-w-56 items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-sm font-black" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
          {companyId ? companyName(companyId) : "Tüm müşteriler"}
          <ChevronDown size={16} />
        </button>
        {pickerOpen && (
          <div className="absolute z-20 mt-1 w-full min-w-56 overflow-hidden rounded-[10px] border" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface, var(--admin-bg))", boxShadow: "var(--admin-shadow-card, var(--admin-shadow))" }}>
            <button type="button" onClick={() => { setCompanyId(""); setPickerOpen(false); }} className="block w-full px-3 py-2 text-left text-sm font-bold" style={{ background: !companyId ? "var(--admin-surface-soft)" : "transparent" }}>Tüm müşteriler</button>
            {companies.map((c) => (
              <button key={c.id} type="button" onClick={() => { setCompanyId(c.id); setPickerOpen(false); }} className="block w-full px-3 py-2 text-left text-sm font-bold" style={{ background: c.id === companyId ? "var(--admin-surface-soft)" : "transparent" }}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mb-3 text-sm font-bold text-[#dc2626]">{error}</p>}

      <div className="grid gap-3">
        {runs && !runs.length && <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Henüz kayıtlı Claude çalışması yok.</p>}
        {runs?.map((run) => (
          <button key={run.id} type="button" onClick={() => setOpenRun(run)} className="rounded-[14px] border p-4 text-left" style={{ borderColor: "var(--admin-border)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{new Date(run.created_at).toLocaleString("tr-TR")}</span>
              <AdminStatusBadge tone={run.status === "completed" ? "success" : "neutral"}>{run.status}</AdminStatusBadge>
            </div>
            <p className="mt-1 font-black">{companyName(run.target_company_id)}</p>
            <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{run.command_text}</p>
            <p className="mt-1 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
              {(run.final_report.sources || []).join(" + ") || "—"} · {run.recommendation_summary?.count || 0} öneri
            </p>
          </button>
        ))}
      </div>

      {openRun && (
        <div role="dialog" aria-modal="true" onMouseDown={() => setOpenRun(null)} className="fixed inset-0 z-[60] flex justify-end" style={{ background: "var(--admin-overlay, rgba(15,23,42,.55))" }}>
          <div onMouseDown={(e) => e.stopPropagation()} className="admin-drawer-panel flex h-full w-full max-w-lg flex-col overflow-y-auto p-5" style={{ background: "var(--admin-surface, var(--admin-bg))" }}>
            <strong className="text-lg font-black">{openRun.command_text}</strong>
            <p className="mt-1 text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{companyName(openRun.target_company_id)} · {new Date(openRun.created_at).toLocaleString("tr-TR")}</p>
            {openRun.final_report.period_start && <p className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>Dönem: {openRun.final_report.period_start} — {openRun.final_report.period_end}</p>}
            <p className="mt-3 text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Kaynaklar</p>
            <p className="text-sm font-bold">{(openRun.final_report.sources || []).join(", ") || "—"}</p>
            <p className="mt-3 text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Özet</p>
            <p className="text-sm">{openRun.final_report.summary || "—"}</p>
            {!!openRun.final_report.findings?.length && (<><p className="mt-3 text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Bulgular</p><ul className="list-disc pl-5 text-sm">{openRun.final_report.findings.map((f, i) => <li key={i}>{f}</li>)}</ul></>)}
            {!!openRun.final_report.hypotheses?.length && (<><p className="mt-3 text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Hipotezler</p><ul className="list-disc pl-5 text-sm">{openRun.final_report.hypotheses.map((f, i) => <li key={i}>{f}</li>)}</ul></>)}
            {!!openRun.final_report.actions?.length && (<><p className="mt-3 text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Aksiyonlar</p><ul className="list-disc pl-5 text-sm">{openRun.final_report.actions.map((f, i) => <li key={i}>{f}</li>)}</ul></>)}
            {!!openRun.final_report.measurement_plan?.length && (<><p className="mt-3 text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Ölçüm Planı</p><ul className="list-disc pl-5 text-sm">{openRun.final_report.measurement_plan.map((f, i) => <li key={i}>{f}</li>)}</ul></>)}
            <p className="mt-3 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{openRun.recommendation_summary?.count || 0} bağlı öneri</p>
          </div>
        </div>
      )}
    </AdminWorkspace>
  );
}

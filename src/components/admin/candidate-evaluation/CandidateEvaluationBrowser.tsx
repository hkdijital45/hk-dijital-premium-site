"use client";
// Shared Aday Değerlendirme (Candidate Evaluation) presentation —
// deliberately separate from Ön İnceleme. Used by:
//  - ReportCenterPanel.tsx ("Aday Değerlendirme Raporları" context)
//  - AdInsightsCenter.tsx / Reklam Doktoru Pro ("Aday Değerlendirmeleri")
// Both need the exact same "pick a prospect, see its full evaluation
// history" browsing UX — extracted here instead of duplicated.
import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { AdminEmptyState, AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Pure, dependency-free generic-value renderer (string / string[] / object
 * table / nested object) — reused from PreAuditCenter.tsx's GenericValue,
 * extracted so both the Ön İnceleme and Aday Değerlendirme viewers render
 * loosely-typed stored JSON the same way without duplicating the logic. */
export function GenericValue({ value }: { value: unknown }) {
  if (typeof value === "string") return <p className="whitespace-pre-line text-sm">{value}</p>;
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string")) {
      return <ul className="grid list-disc gap-1 pl-5 text-sm">{value.map((v, i) => <li key={i}>{v}</li>)}</ul>;
    }
    const rows = value.filter((v): v is Record<string, unknown> => !!v && typeof v === "object");
    if (rows.length) {
      const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))].slice(0, 8);
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--admin-border)" }}>
                {columns.map((c) => <th key={c} className="px-2 py-1.5 text-left text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>{c.replaceAll("_", " ")}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                  {columns.map((c) => <td key={c} className="px-2 py-1.5 align-top">{typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c] ?? "—")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return null;
  }
  if (value && typeof value === "object") {
    return (
      <div className="grid gap-1.5 text-sm">
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k}><strong className="font-black">{k.replaceAll("_", " ")}:</strong> {typeof v === "object" ? <GenericValue value={v} /> : String(v ?? "—")}</div>
        ))}
      </div>
    );
  }
  return <p className="text-sm">{String(value)}</p>;
}

export type CandidateEvaluationListItem = { id: string; company_id: string | null; lead_id: string | null; title: string; report_date: string; recommendation: string; priority: string; score: number | null; created_at: string; updated_at: string };

/** Full-detail render for one candidate_evaluations row — only the fields
 * that actually have data, never an empty placeholder. */
export function CandidateEvaluationDetail({ report }: { report: Record<string, unknown> | null }) {
  if (!report) return <p className="text-sm" style={{ color: "var(--admin-text-muted, #64748b)" }}>Rapor yüklenemedi.</p>;
  return (
    <div className="grid gap-3">
      {(report.report_content as string) && <GenericValue value={report.report_content} />}
      {Array.isArray(report.strengths) && (report.strengths as string[]).length > 0 && (
        <div><p className="text-xs font-black uppercase tracking-[.1em]" style={{ color: "var(--admin-text-muted, #64748b)" }}>Güçlü yönler</p><GenericValue value={report.strengths} /></div>
      )}
      {Array.isArray(report.weaknesses) && (report.weaknesses as string[]).length > 0 && (
        <div><p className="text-xs font-black uppercase tracking-[.1em]" style={{ color: "var(--admin-text-muted, #64748b)" }}>Zayıf yönler</p><GenericValue value={report.weaknesses} /></div>
      )}
      {Array.isArray(report.digital_opportunities) && (report.digital_opportunities as string[]).length > 0 && (
        <div><p className="text-xs font-black uppercase tracking-[.1em]" style={{ color: "var(--admin-text-muted, #64748b)" }}>Dijital fırsatlar</p><GenericValue value={report.digital_opportunities} /></div>
      )}
      {(report.suggested_next_action as string) && (
        <div><p className="text-xs font-black uppercase tracking-[.1em]" style={{ color: "var(--admin-text-muted, #64748b)" }}>Önerilen sonraki adım</p><GenericValue value={report.suggested_next_action} /></div>
      )}
    </div>
  );
}

type Entity = { key: string; name: string; count: number; latestDate: string };

/**
 * "İşletme / Aday Seç" selector (NOT a customer selector — populated only
 * from businesses/leads that actually have at least one candidate
 * evaluation) + full history for the selected entity. Zero coupling to
 * any customer-only selector/list elsewhere in the app; a prospect
 * appearing here never makes it a customer.
 */
export function CandidateEvaluationBrowser({ allCompanies = [] }: { allCompanies?: Array<{ id: string; name?: string; company_name?: string }> }) {
  const [reports, setReports] = useState<CandidateEvaluationListItem[] | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/candidate-evaluation").then((r) => r.json()).then((body) => setReports(body.reports || [])).catch(() => setReports([]));
  }, []);

  const entities = useMemo<Entity[]>(() => {
    if (!reports) return [];
    const map = new Map<string, Entity>();
    for (const r of reports) {
      const key = r.company_id ? `company:${r.company_id}` : r.lead_id ? `lead:${r.lead_id}` : null;
      if (!key) continue;
      const company = r.company_id ? allCompanies.find((c) => c.id === r.company_id) : null;
      const name = company?.name || company?.company_name || r.title || "İsimsiz aday";
      const reportDate = r.report_date || r.created_at;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (reportDate > existing.latestDate) existing.latestDate = reportDate;
      } else {
        map.set(key, { key, name, count: 1, latestDate: reportDate });
      }
    }
    return [...map.values()].sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  }, [reports, allCompanies]);

  const selectedReports = useMemo(() => {
    if (!reports || !selectedKey) return [];
    const [kind, id] = selectedKey.split(":");
    return reports
      .filter((r) => (kind === "company" ? r.company_id === id : r.lead_id === id))
      .sort((a, b) => (b.report_date || b.created_at).localeCompare(a.report_date || a.created_at));
  }, [reports, selectedKey]);

  async function openDetail(id: string) {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/candidate-evaluation/${id}`);
      const body = await res.json();
      setDetail(res.ok ? body.report : null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  if (reports === null) return <AdminLoadingState label="Aday değerlendirme raporları yükleniyor..." />;

  return (
    <div className="grid gap-3">
      <div className="hk-card p-4">
        <label className="text-xs font-black" style={{ color: "var(--admin-text-secondary)" }}>İşletme / Aday Seç</label>
        <select
          value={selectedKey}
          onChange={(e) => { setSelectedKey(e.target.value); setExpandedId(null); }}
          className="mt-1 min-h-9 w-full max-w-md rounded-[8px] border px-3 text-sm"
          style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }}
        >
          <option value="">İşletme/aday seçin ({entities.length})</option>
          {entities.map((e) => <option key={e.key} value={e.key}>{e.name} ({e.count})</option>)}
        </select>
      </div>

      {!entities.length && <AdminEmptyState title="Henüz görüntülenecek rapor bulunmuyor." />}
      {selectedKey && !selectedReports.length && <AdminEmptyState title="Bu işletme için henüz aday değerlendirme raporu bulunmuyor." />}

      {selectedReports.map((r) => (
        <div key={r.id} className="hk-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black">{r.title || "İsimsiz aday"}</p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold" style={{ color: "var(--admin-text-muted, #64748b)" }}>
                {r.recommendation && <AdminStatusBadge tone={r.recommendation.toLocaleLowerCase("tr").includes("değil") ? "danger" : "success"}>{r.recommendation}</AdminStatusBadge>}
                {r.priority && <AdminStatusBadge tone="info">{r.priority}</AdminStatusBadge>}
                {typeof r.score === "number" && <span>Puan: {r.score}/100</span>}
                <span>{formatDate(r.report_date)}</span>
              </p>
            </div>
            <AdminButton variant="secondary" compact icon={<Eye size={13} />} onClick={() => openDetail(r.id)}>{expandedId === r.id ? "Gizle" : "Detay"}</AdminButton>
          </div>
          {expandedId === r.id && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--admin-border)" }}>
              {detailLoading ? <p className="text-sm" style={{ color: "var(--admin-text-muted, #64748b)" }}>Yükleniyor…</p> : <CandidateEvaluationDetail report={detail} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as AdEvaluationPanel.tsx */

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Archive, ArchiveRestore, Trash2, Pencil, Eye, ExternalLink, RefreshCw } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminEmptyState, AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import { filterSelectableCustomers } from "@/lib/customer-visibility";
import { formatReportTimestamp } from "@/lib/report-timestamp";
import { PRE_AUDIT_SECTION_LABELS } from "@/lib/pre-audit/types";
import { GenericValue, CandidateEvaluationBrowser } from "@/components/admin/candidate-evaluation/CandidateEvaluationBrowser";

type ReportContext = "customer" | "pre_audit" | "candidate_evaluation";
const REPORT_CONTEXTS: Array<{ key: ReportContext; label: string }> = [
  { key: "customer", label: "Müşteri Raporları" },
  { key: "pre_audit", label: "Ön İnceleme Raporları" },
  { key: "candidate_evaluation", label: "Aday Değerlendirme Raporları" }
];

function ReportContextSwitcher({ value, onChange }: { value: ReportContext; onChange: (v: ReportContext) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Rapor Merkezi bağlamı">
      {REPORT_CONTEXTS.map((c) => (
        <button
          key={c.key} type="button" role="tab" aria-selected={value === c.key}
          onClick={() => onChange(c.key)}
          className="rounded-full px-3.5 py-2 text-xs font-black"
          style={value === c.key ? { background: "#0f172a", color: "#ffffff" } : { background: "var(--admin-surface-soft, #f1f5f9)", color: "var(--admin-text-secondary)" }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

type PreAuditListItem = { id: string; company_id: string | null; lead_id: string | null; title: string; status: string; report_date: string; created_at: string; updated_at: string };

/** "İşletme / Aday Seç" (never a customer selector) populated only from
 * businesses/leads that actually have at least one pre_audit_reports row —
 * reuses the same list/detail API routes Ön İnceleme Merkezi already uses. */
function PreAuditEntityBrowser({ allCompanies = [] }: { allCompanies?: Array<{ id: string; name?: string; company_name?: string }> }) {
  const [reports, setReports] = useState<PreAuditListItem[] | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/pre-audit").then((r) => r.json()).then((body) => setReports(body.reports || [])).catch(() => setReports([]));
  }, []);

  const entities = useMemo(() => {
    if (!reports) return [];
    const map = new Map<string, { key: string; name: string; count: number; latestDate: string }>();
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
      const res = await fetch(`/api/admin/pre-audit/${id}`);
      const body = await res.json();
      setDetail(res.ok ? body : null);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  if (reports === null) return <AdminLoadingState label="Ön inceleme raporları yükleniyor..." />;

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
      {selectedKey && !selectedReports.length && <AdminEmptyState title="Bu işletme için henüz ön inceleme raporu bulunmuyor." />}

      {selectedReports.map((r) => (
        <div key={r.id} className="hk-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black">{r.title || "İsimsiz rapor"}</p>
              <p className="mt-1 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
                {new Date(r.report_date || r.created_at).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}
                {r.status ? ` · ${r.status}` : ""}
              </p>
            </div>
            <AdminButton variant="secondary" compact icon={<Eye size={13} />} onClick={() => openDetail(r.id)}>{expandedId === r.id ? "Gizle" : "Detay"}</AdminButton>
          </div>
          {expandedId === r.id && (
            <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--admin-border)" }}>
              {detailLoading ? (
                <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor…</p>
              ) : detail ? (
                <div className="grid gap-3">
                  {PRE_AUDIT_SECTION_LABELS.map(([field, label]) => {
                    const value = (detail as Record<string, unknown>)[field];
                    if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length) || (typeof value === "object" && !Array.isArray(value) && !Object.keys(value as object).length)) return null;
                    return (
                      <div key={field}>
                        <p className="text-xs font-black uppercase tracking-[.1em]" style={{ color: "var(--admin-text-muted)" }}>{label}</p>
                        <GenericValue value={value} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Rapor yüklenemedi.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type ReportSection = { title: string; content: string };
type ReportText = { executiveSummary?: string; sections?: ReportSection[] };
type SourceType = "ad_strategy" | "ad_creative_report" | "ad_evaluation" | "pre_audit" | "monthly_report" | "customer_report";

type ReportCenterItem = {
  id: string; sourceType: SourceType; sourceId: string; companyId: string;
  title: string; reportDate: string | null; period: string | null; status: string | null; statusLabel: string | null;
  clientVisible: boolean | null; campaignName: string | null; summary: string | null;
  internalAvailable: boolean; clientAvailable: boolean; archived: boolean;
  decision: string | null; decisionLabel: string | null;
  metricsSummary: { spend: number | null; results: number | null; costPerResult: number | null } | null;
  sourceHref: string;
  capabilities: { view: boolean; edit: boolean; archive: boolean; delete: boolean; internalPdf: boolean; internalDocx: boolean; clientPdf: boolean; clientDocx: boolean };
  createdAt: string; updatedAt: string;
};

const SOURCE_LABELS: Record<SourceType, string> = {
  ad_strategy: "Reklam Stratejisi", ad_creative_report: "Reklam Kreatif Raporu", ad_evaluation: "Reklam Değerlendirmesi",
  pre_audit: "Ön İnceleme", monthly_report: "Aylık Rapor", customer_report: "Müşteri Raporu"
};
const TABS: Array<{ key: "all" | SourceType; label: string }> = [
  { key: "all", label: "Tüm Raporlar" }, { key: "ad_strategy", label: "Reklam Stratejileri" },
  { key: "ad_creative_report", label: "Reklam Kreatif Raporları" }, { key: "ad_evaluation", label: "Reklam Değerlendirmeleri" },
  { key: "pre_audit", label: "Ön İnceleme" }, { key: "monthly_report", label: "Aylık Raporlar" }, { key: "customer_report", label: "Müşteri Raporları" }
];
const STATUS_TONE: Record<string, AdminStatusTone> = {
  draft: "neutral", Taslak: "neutral", approved: "info", active: "success", evaluated: "success",
  archived: "neutral", updated: "warning", Aktif: "success", "Tamamlandı": "success"
};

function fmtMoney(value: number | null | undefined) {
  return value == null ? "Veri yok" : `${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} TL`;
}

function evaluationExportUrl(sourceId: string, companyId: string, mode: "internal" | "client", format: "pdf" | "docx") {
  return `/api/admin/ad-insights/evaluations/${sourceId}/export?companyId=${companyId}&mode=${mode}&format=${format}`;
}
function preAuditExportUrl(sourceId: string, format: "pdf" | "docx") {
  return `/api/admin/pre-audit/${sourceId}/export?format=${format}`;
}
function customerReportExportUrl(sourceId: string, format: "pdf" | "word") {
  return `/api/admin/reports/${sourceId}/export?format=${format}`;
}

async function fetchStrategyOrCreativeBlob(sourceType: "ad_strategy" | "ad_creative_report", sourceId: string, companyId: string, mode: "internal" | "client", format: "pdf" | "docx") {
  const path = sourceType === "ad_strategy" ? "ads-strategy" : "creative-reports";
  const res = await fetch(`/api/admin/ad-insights/${path}/${sourceId}/export`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId, mode, format })
  });
  if (!res.ok) throw new Error("Belge oluşturulamadı.");
  const disposition = res.headers.get("Content-Disposition") || "";
  const filenameMatch = disposition.match(/filename="([^"]+)"/);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filenameMatch?.[1] || `rapor.${format}`; link.click();
  URL.revokeObjectURL(url);
}

export function ReportCenterPanel({ content, notify }: { content: any; notify?: (message: string, type?: string) => void }) {
  const companies = useMemo(() => filterSelectableCustomers(content?.companies || []), [content?.companies]);
  // Unfiltered — only used to resolve a display NAME for an entity in the
  // Ön İnceleme/Aday Değerlendirme contexts (which may include a company
  // that isn't yet "selectable" as a customer). Never used to populate the
  // customer-only selector above, which stays exactly as it was.
  const allCompanies = content?.companies || [];
  const [reportContext, setReportContext] = useState<ReportContext>("customer");
  const [companyId, setCompanyId] = useState("");
  const [items, setItems] = useState<ReportCenterItem[]>([]);
  const [summary, setSummary] = useState<{ total: number; completed: number; draft: number; clientVisible: number; archived: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | SourceType>("all");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ item: ReportCenterItem; internalSummary: string; clientSummary: string; decision: string; nextReviewAt: string; nextReviewNote: string } | null>(null);

  async function load() {
    if (!companyId) { setItems([]); setSummary(null); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/report-center?companyId=${companyId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Rapor merkezi verisi alınamadı.");
      setItems(body.items || []); setSummary(body.summary || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load is a stable fetch-on-mount function keyed only by companyId, same pattern as AdEvaluationPanel.tsx's loadHistory/loadContext
  useEffect(() => { load(); }, [companyId]);

  const filtered = items.filter((it) => {
    if (tab !== "all" && it.sourceType !== tab) return false;
    if (!showArchived && it.archived) return false;
    if (search.trim()) {
      const needle = search.trim().toLocaleLowerCase("tr");
      const haystack = `${it.title} ${it.campaignName || ""} ${it.summary || ""}`.toLocaleLowerCase("tr");
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  async function handleEvaluationStatus(item: ReportCenterItem, status: "archived" | "evaluated") {
    setBusyAction(`${item.id}-status`);
    try {
      const res = await fetch(`/api/admin/ad-insights/evaluations/${item.sourceId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: item.companyId, status })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Durum güncellenemedi.");
      notify?.(status === "archived" ? "Değerlendirme arşivlendi." : "Değerlendirme arşivden çıkarıldı.", "success");
      load();
    } catch (e) {
      notify?.(e instanceof Error ? e.message : "Beklenmeyen hata.", "error");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete(item: ReportCenterItem) {
    setBusyAction(`${item.id}-delete`);
    try {
      const res = await fetch(`/api/admin/ad-insights/evaluations/${item.sourceId}?companyId=${item.companyId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Silinemedi.");
      notify?.("Değerlendirme silindi.", "success");
      setConfirmDeleteId(null);
      load();
    } catch (e) {
      notify?.(e instanceof Error ? e.message : "Beklenmeyen hata.", "error");
    } finally {
      setBusyAction(null);
    }
  }

  function openEdit(item: ReportCenterItem, full: ReportText | null, clientFull: ReportText | null) {
    setEditing({
      item,
      internalSummary: full?.executiveSummary || "",
      clientSummary: clientFull?.executiveSummary || "",
      decision: item.decision || "",
      nextReviewAt: "",
      nextReviewNote: ""
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setBusyAction("edit-save");
    try {
      const res = await fetch(`/api/admin/ad-insights/evaluations/${editing.item.sourceId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: editing.item.companyId,
          internalReport: { executiveSummary: editing.internalSummary },
          clientReport: { executiveSummary: editing.clientSummary },
          decision: editing.decision || null,
          nextReviewAt: editing.nextReviewAt || null,
          nextReviewNote: editing.nextReviewNote || null,
          regenerateReports: true
        })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Kaydedilemedi.");
      notify?.("Değerlendirme güncellendi ve raporlar yeniden oluşturuldu.", "success");
      setEditing(null);
      load();
    } catch (e) {
      notify?.(e instanceof Error ? e.message : "Beklenmeyen hata.", "error");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDocDownload(item: ReportCenterItem, mode: "internal" | "client", format: "pdf" | "docx") {
    const key = `${item.id}-${mode}-${format}`;
    setBusyAction(key);
    try {
      if (item.sourceType === "ad_evaluation") {
        window.open(evaluationExportUrl(item.sourceId, item.companyId, mode, format), "_blank");
      } else if (item.sourceType === "pre_audit") {
        window.open(preAuditExportUrl(item.sourceId, format), "_blank");
      } else if (item.sourceType === "customer_report") {
        window.open(customerReportExportUrl(item.sourceId, format === "docx" ? "word" : "pdf"), "_blank");
      } else if (item.sourceType === "ad_strategy" || item.sourceType === "ad_creative_report") {
        await fetchStrategyOrCreativeBlob(item.sourceType, item.sourceId, item.companyId, mode, format);
      }
    } catch (e) {
      notify?.(e instanceof Error ? e.message : "Belge indirilemedi.", "error");
    } finally {
      setBusyAction(null);
    }
  }

  if (reportContext === "pre_audit") {
    return (
      <div className="space-y-4">
        <ReportContextSwitcher value={reportContext} onChange={setReportContext} />
        <PreAuditEntityBrowser allCompanies={allCompanies} />
      </div>
    );
  }
  if (reportContext === "candidate_evaluation") {
    return (
      <div className="space-y-4">
        <ReportContextSwitcher value={reportContext} onChange={setReportContext} />
        <CandidateEvaluationBrowser allCompanies={allCompanies} />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="space-y-4">
        <ReportContextSwitcher value={reportContext} onChange={setReportContext} />
        <div className="hk-card p-6 text-center">
          <h2 className="text-lg font-semibold text-[var(--admin-text-primary)]">Rapor Merkezi</h2>
          <p className="mt-2 text-sm text-[var(--admin-text-secondary)]">Raporları görüntülemek için önce bir müşteri seçin.</p>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="mt-4 min-h-10 w-full max-w-sm mx-auto rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text-primary)]"
          >
            <option value="">Müşteri seçin</option>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name || c.company_name}</option>)}
          </select>
        </div>
      </div>
    );
  }

  const selectedCompany = companies.find((c: any) => c.id === companyId);

  return (
    <div className="space-y-4">
      <ReportContextSwitcher value={reportContext} onChange={setReportContext} />
      <div className="hk-card flex flex-wrap items-center gap-3 p-4">
        <div className="flex-1 min-w-[200px]">
          <div className="text-xs text-[var(--admin-text-secondary)]">Müşteri</div>
          <select
            value={companyId}
            onChange={(e) => { setCompanyId(e.target.value); setTab("all"); setExpandedId(null); }}
            className="mt-1 min-h-9 w-full rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text-primary)]"
          >
            <option value="">Müşteri seçin</option>
            {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name || c.company_name}</option>)}
          </select>
        </div>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rapor ara…"
          className="min-h-9 flex-1 min-w-[160px] rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text-primary)]"
        />
        <label className="flex items-center gap-2 text-sm text-[var(--admin-text-secondary)]">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Arşivlenenleri göster
        </label>
        <AdminButton variant="secondary" compact icon={<RefreshCw size={14} />} loading={loading} onClick={load}>Yenile</AdminButton>
      </div>

      {error && <div className="hk-card border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: "Toplam Rapor", value: summary.total },
            { label: "Hazır / Tamamlanan", value: summary.completed },
            { label: "Taslak", value: summary.draft },
            { label: "Müşteriye Açık", value: summary.clientVisible },
            { label: "Arşivlenen", value: summary.archived }
          ].map((card) => (
            <div key={card.label} className="hk-card p-3 text-center">
              <div className="text-2xl font-semibold text-[var(--admin-text-primary)]">{card.value}</div>
              <div className="text-xs text-[var(--admin-text-secondary)]">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-sm whitespace-nowrap ${tab === t.key ? "bg-[var(--admin-accent)] text-white" : "bg-[var(--admin-surface)] text-[var(--admin-text-secondary)] border border-[var(--admin-border)]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading && <div className="hk-card p-6 text-center text-sm text-[var(--admin-text-secondary)]">Yükleniyor…</div>}
        {!loading && filtered.length === 0 && (
          <div className="hk-card p-6 text-center text-sm text-[var(--admin-text-secondary)]">
            {selectedCompany ? `${selectedCompany.name || selectedCompany.company_name} için kayıtlı rapor bulunamadı.` : "Rapor bulunamadı."}
          </div>
        )}
        {filtered.map((item, index) => (
          <div key={item.id} className="hk-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-[220px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[var(--admin-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--admin-text-secondary)]">{SOURCE_LABELS[item.sourceType]}</span>
                  {/* filtered is already sorted newest-first server-side
                      (report-center.ts sorts by reportDate||createdAt
                      DESC) — index 0 of the CURRENTLY FILTERED list is
                      the real newest report within what's actually
                      visible, never a fabricated/re-sorted position. */}
                  {index === 0 && <AdminStatusBadge tone="success">En Son Rapor</AdminStatusBadge>}
                  {item.statusLabel && <AdminStatusBadge tone={STATUS_TONE[item.status || ""] || "neutral"}>{item.statusLabel}</AdminStatusBadge>}
                  {item.clientVisible && <AdminStatusBadge tone="info">Müşteriye Açık</AdminStatusBadge>}
                  {item.decisionLabel && <AdminStatusBadge tone="success">{item.decisionLabel}</AdminStatusBadge>}
                </div>
                <h3 className="mt-1 text-sm font-semibold text-[var(--admin-text-primary)]">{item.title}</h3>
                <div className="mt-0.5 text-xs text-[var(--admin-text-secondary)]">
                  Rapor tarihi: {formatReportTimestamp(item.reportDate)}{item.period ? ` · ${item.period}` : ""}{item.campaignName ? ` · ${item.campaignName}` : ""}
                </div>
                {item.summary && <p className="mt-1 text-sm text-[var(--admin-text-secondary)] line-clamp-2">{item.summary}</p>}
                {item.metricsSummary && (
                  <div className="mt-1 text-xs text-[var(--admin-text-secondary)]">
                    Harcama: {fmtMoney(item.metricsSummary.spend)} · Sonuç: {item.metricsSummary.results ?? "Veri yok"} · Sonuç başı maliyet: {fmtMoney(item.metricsSummary.costPerResult)}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {item.capabilities.view && (
                  <AdminButton variant="success" compact icon={<Eye size={14} />} onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                    Görüntüle
                  </AdminButton>
                )}
                {item.capabilities.edit && (
                  <AdminButton variant="info" compact icon={<Pencil size={14} />} onClick={() => openEdit(item, { executiveSummary: item.summary || "" }, { executiveSummary: item.summary || "" })}>
                    Düzenle
                  </AdminButton>
                )}
                {item.capabilities.internalPdf && <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={busyAction === `${item.id}-internal-pdf`} onClick={() => handleDocDownload(item, "internal", "pdf")}>Dahili PDF</AdminButton>}
                {item.capabilities.internalDocx && <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={busyAction === `${item.id}-internal-docx`} onClick={() => handleDocDownload(item, "internal", "docx")}>Dahili Word</AdminButton>}
                {item.capabilities.clientPdf && <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={busyAction === `${item.id}-client-pdf`} onClick={() => handleDocDownload(item, "client", "pdf")}>Müşteri PDF</AdminButton>}
                {item.capabilities.clientDocx && <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={busyAction === `${item.id}-client-docx`} onClick={() => handleDocDownload(item, "client", "docx")}>Müşteri Word</AdminButton>}
                {item.capabilities.archive && !item.archived && (
                  <AdminButton variant="warning" compact icon={<Archive size={14} />} loading={busyAction === `${item.id}-status`} onClick={() => handleEvaluationStatus(item, "archived")}>Arşivle</AdminButton>
                )}
                {item.capabilities.archive && item.archived && (
                  <AdminButton variant="success" compact icon={<ArchiveRestore size={14} />} loading={busyAction === `${item.id}-status`} onClick={() => handleEvaluationStatus(item, "evaluated")}>Arşivden Çıkar</AdminButton>
                )}
                {item.capabilities.delete && (
                  <AdminButton variant="danger" compact icon={<Trash2 size={14} />} onClick={() => setConfirmDeleteId(item.id)}>Sil</AdminButton>
                )}
                <a href={item.sourceHref} className="hk-button hk-button-ghost hk-button-compact" title="Kaynak Modüle Git">
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            {expandedId === item.id && (
              <div className="mt-3 rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface-muted)] p-3 text-sm">
                {item.internalAvailable && (
                  <div className="mb-2">
                    <div className="text-xs font-semibold uppercase text-[var(--admin-text-secondary)]">Dahili Rapor</div>
                    <p className="mt-1 whitespace-pre-wrap text-[var(--admin-text-primary)]">{item.summary || "İçerik mevcut — detay için kaynak modülü açın."}</p>
                  </div>
                )}
                {item.clientAvailable && (
                  <div>
                    <div className="text-xs font-semibold uppercase text-[var(--admin-text-secondary)]">Müşteri Raporu</div>
                    <p className="mt-1 whitespace-pre-wrap text-[var(--admin-text-primary)]">{item.summary || "İçerik mevcut — detay için kaynak modülü açın."}</p>
                  </div>
                )}
                {!item.internalAvailable && !item.clientAvailable && <p className="text-[var(--admin-text-secondary)]">Bu rapor için henüz içerik oluşturulmamış.</p>}
                <a href={item.sourceHref} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--admin-accent)]"><FileText size={12} /> Kaynak modülde tam detayı aç</a>
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="hk-card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[var(--admin-text-primary)]">Değerlendirmeyi Düzenle</h3>
            <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">Metrik anlık görüntüsü (metrics_snapshot) değiştirilemez — yalnızca rapor metni, karar ve sonraki kontrol düzenlenebilir.</p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="text-xs text-[var(--admin-text-secondary)]">Dahili Rapor — Yönetici Özeti</label>
                <textarea value={editing.internalSummary} onChange={(e) => setEditing({ ...editing, internalSummary: e.target.value })} rows={3} className="mt-1 w-full rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 text-sm text-[var(--admin-text-primary)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--admin-text-secondary)]">Müşteri Raporu — Kısa Özet</label>
                <textarea value={editing.clientSummary} onChange={(e) => setEditing({ ...editing, clientSummary: e.target.value })} rows={3} className="mt-1 w-full rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 text-sm text-[var(--admin-text-primary)]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[var(--admin-text-secondary)]">Sonraki Kontrol Tarihi</label>
                  <input type="date" value={editing.nextReviewAt} onChange={(e) => setEditing({ ...editing, nextReviewAt: e.target.value })} className="mt-1 w-full rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 text-sm text-[var(--admin-text-primary)]" />
                </div>
                <div>
                  <label className="text-xs text-[var(--admin-text-secondary)]">Sonraki Kontrol Notu</label>
                  <input value={editing.nextReviewNote} onChange={(e) => setEditing({ ...editing, nextReviewNote: e.target.value })} className="mt-1 w-full rounded-[8px] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 text-sm text-[var(--admin-text-primary)]" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <AdminButton variant="ghost" compact onClick={() => setEditing(null)}>İptal</AdminButton>
              <AdminButton variant="info" compact loading={busyAction === "edit-save"} onClick={saveEdit}>Kaydet ve Raporları Yenile</AdminButton>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmDeleteId(null)}>
          <div className="hk-card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const item = items.find((i) => i.id === confirmDeleteId);
              if (!item) return null;
              return (
                <>
                  <h3 className="text-sm font-semibold text-red-700">Raporu Sil</h3>
                  <p className="mt-2 text-sm text-[var(--admin-text-primary)]">
                    <strong>{item.title}</strong> ({formatReportTimestamp(item.reportDate)}) kalıcı olarak silinecek. Bu işlem geri alınamaz.
                  </p>
                  <div className="mt-4 flex justify-end gap-2">
                    <AdminButton variant="ghost" compact onClick={() => setConfirmDeleteId(null)}>Vazgeç</AdminButton>
                    <AdminButton variant="danger" compact loading={busyAction === `${item.id}-delete`} onClick={() => handleDelete(item)}>Evet, Sil</AdminButton>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

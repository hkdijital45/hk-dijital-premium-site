"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as ContentPlanningCenter.tsx */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Archive, ArchiveRestore, ArrowRight, Building2, CheckCircle2, ChevronDown, Clock, Copy, Eye, ExternalLink, FileDown, Gauge, Inbox, Layers, Pencil, Plus, RefreshCw, Search, Sparkles, Trash2, UserCheck, X, XCircle } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { PRE_AUDIT_SECTION_LABELS, PRE_AUDIT_INTERNAL_SECTION_LABELS } from "@/lib/pre-audit/types";
import { isArchivedPreAuditReport } from "@/lib/pre-audit/report-actions";
import { leadDisplayName, buildClaudePrompt, buildCandidateEvaluationPrompt } from "@/lib/pre-audit/lead-prompts";
import { CandidateEvaluationDetail } from "@/components/admin/candidate-evaluation/CandidateEvaluationBrowser";

const REJECTION_REASONS = [
  "Uygun müşteri değil", "Dijital ihtiyacı düşük", "Bütçe potansiyeli düşük",
  "Zaten güçlü dijital altyapısı var", "Yanlış / geçersiz işletme", "Tekrar kayıt",
  "İletişim kurulması uygun değil", "Diğer"
];

/**
 * Ön İnceleme Merkezi — a report management/viewing center for pre-sale
 * digital research reports. Reports are authored entirely by the "HK
 * Dijital — Ön İnceleme" Claude Project via MCP (get_pre_audit_context /
 * save_pre_audit_report / get_latest_pre_audit_report) — this screen never
 * re-does the research itself, only lists and displays what was saved.
 */

type Company = { id: string; name: string };
type ReportType = "INTERNAL_REPORT" | "CLIENT_REPORT";
type ListItem = { id: string; company_id: string | null; lead_id: string | null; analysis_group_id: string; report_type: ReportType; title: string; status: string; report_date: string; recommended_package: unknown; created_at: string; updated_at: string };
type Summary = { totalPreAudits: number; thisMonth: number; potentialCompanies: number; convertedCompanies: number };
type FullReport = Record<string, unknown> & { id: string; report_type: ReportType; title: string; status: string; report_date: string; analysis_group_id: string; company_id: string | null; lead_id: string | null };
export type QueueLead = {
  id: string; company: string | null; name: string | null; sector: string | null; business_type: string | null;
  city: string | null; district: string | null; website: string | null; phone: string | null; instagram: string | null;
  status: string | null; rejection_reason: string | null; rejected_at: string | null; notes: string | null;
  google_place_id: string | null; source: string | null; created_at: string;
};
type Queue = { pending: QueueLead[]; inReview: QueueLead[]; rejected: QueueLead[] };
type Tab = "tamamlanan" | "bekleyen" | "inceleniyor" | "iptal" | "arsiv";
// Candidate Evaluation ("Aday Değerlendirme") is a separate report family
// from Ön İnceleme (deliberately not merged into the Tab union/stages/
// emptyForTab machinery above, which is built entirely around the lead
// pre-review queue + pre_audit_reports groups) — modeled as an additional
// view the same `tab` state can hold, rendered as its own self-contained
// section below.
type ExtendedTab = Tab | "aday-degerlendirme";
type CandidateEvalListItem = { id: string; company_id: string | null; lead_id: string | null; title: string; report_date: string; recommendation: string; priority: string; score: number | null; created_at: string; updated_at: string };
type SortKey = "new" | "old" | "az" | "za";

const SECTION_LABELS = PRE_AUDIT_SECTION_LABELS;
const INTERNAL_SECTION_LABELS = PRE_AUDIT_INTERNAL_SECTION_LABELS;

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

/** DB timestamps are UTC; toLocaleString with no explicit timeZone uses
 * the browser's own local timezone (the same conversion standard every
 * other admin timestamp in this app already relies on) — no hard-coded
 * offset. */
function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Same underlying timestamp truncated to the minute can differ by a
 * few ms (created_at/updated_at set in the same DB write) — compare at
 * minute granularity so a save that never touched a field doesn't show
 * a misleading "Son güncelleme" that's identical to "Oluşturuldu" down
 * to the millisecond, or conversely hide a real same-minute update. */
function isMeaningfullyUpdated(createdAt: string | null | undefined, updatedAt: string | null | undefined) {
  if (!createdAt || !updatedAt) return false;
  return Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) >= 60000;
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>{children}</div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-[16px] bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-base font-black">{title}</p>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-[#F3F2EE]"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <AdminButton variant="secondary" compact icon={<Copy size={13} />} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard denied */ }
    }}>
      {copied ? "Kopyalandı ✓" : "Kopyala"}
    </AdminButton>
  );
}

function GenericValue({ value }: { value: unknown }) {
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

function SwotSection({ swot }: { swot: unknown }) {
  const s = (swot && typeof swot === "object" ? swot : {}) as Record<string, unknown>;
  const quadrants: Array<[string, string, string]> = [
    ["strengths", "Güçlü Yönler", "#E8F8EC"],
    ["weaknesses", "Zayıf Yönler", "#FDECEC"],
    ["opportunities", "Fırsatlar", "#EAF6FD"],
    ["threats", "Tehditler / Rekabet Riskleri", "#FFF7E2"]
  ];
  const present = quadrants.filter(([key]) => !isEmpty(s[key]));
  if (!present.length) return null;
  return (
    <Card>
      <p className="mb-3 text-sm font-black">SWOT</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {present.map(([key, label, bg]) => (
          <div key={key} className="rounded-[10px] p-3" style={{ background: bg }}>
            <p className="mb-1.5 text-xs font-black uppercase tracking-wide">{label}</p>
            <GenericValue value={s[key]} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReportDetail({ report, onSendOffer, onReject, onExport, exportBusy }: { report: FullReport; onSendOffer?: (report: FullReport) => void; onReject?: (report: FullReport) => void; onExport?: (report: FullReport, format: "pdf" | "docx") => void; exportBusy?: string }) {
  const isInternal = report.report_type === "INTERNAL_REPORT";
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge tone={isInternal ? "warning" : "success"}>{isInternal ? "🔒 Dahili Rapor — HK Dijital İç Kullanım" : "📄 Müşteri Raporu — Müşteriye Sunulabilir"}</AdminStatusBadge>
        <AdminStatusBadge tone="neutral">{formatDate(report.report_date as string)}</AdminStatusBadge>
        <AdminStatusBadge tone="info">{String(report.status || "draft")}</AdminStatusBadge>
      </div>
      <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
        Oluşturuldu: {formatDateTime(report.created_at as string)}
        {isMeaningfullyUpdated(report.created_at as string, report.updated_at as string) && <> · Son güncelleme: {formatDateTime(report.updated_at as string)}</>}
      </p>

      {onExport && (
        <div className="flex flex-wrap gap-2">
          <AdminButton variant="secondary" compact icon={<FileDown size={14} />} loading={exportBusy === `${report.id}-pdf`} disabled={Boolean(exportBusy)} onClick={() => onExport(report, "pdf")}>PDF İndir</AdminButton>
          <AdminButton variant="secondary" compact icon={<FileDown size={14} />} loading={exportBusy === `${report.id}-docx`} disabled={Boolean(exportBusy)} onClick={() => onExport(report, "docx")}>Word İndir</AdminButton>
        </div>
      )}

      {report.lead_id && (onSendOffer || onReject) && (
        <div className="flex flex-wrap gap-2">
          {onSendOffer && <AdminButton variant="success" icon={<span>🟢</span>} onClick={() => onSendOffer(report)}>Teklif Gönder</AdminButton>}
          {onReject && <AdminButton variant="danger" icon={<span>🔴</span>} onClick={() => onReject(report)}>İptal</AdminButton>}
        </div>
      )}

      {SECTION_LABELS.filter(([key]) => !isEmpty(report[key])).map(([key, label]) => (
        key === "swot" ? null : (
          <Card key={key}>
            <p className="mb-2 text-sm font-black">{label}</p>
            <GenericValue value={report[key]} />
          </Card>
        )
      ))}

      {!isEmpty(report.swot) && <SwotSection swot={report.swot} />}

      {isInternal && INTERNAL_SECTION_LABELS.some(([key]) => !isEmpty(report[key])) && (
        <>
          <p className="mt-2 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>HK Dijital İç Kullanım — Satış İletişimi</p>
          {INTERNAL_SECTION_LABELS.filter(([key]) => !isEmpty(report[key])).map(([key, label]) => (
            <Card key={key}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-black">{label}</p>
                {typeof report[key] === "string" && <CopyButton text={report[key] as string} />}
              </div>
              <GenericValue value={report[key]} />
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

function QueueLeadRow({ lead, isRejected, onCopyPrompt, onCopyCandidatePrompt, onReject }: { lead: QueueLead; isRejected?: boolean; onCopyPrompt?: (lead: QueueLead) => void; onCopyCandidatePrompt?: (lead: QueueLead) => void; onReject?: (lead: QueueLead) => void }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black">{leadDisplayName(lead)}</p>
          <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
            {[lead.sector || lead.business_type, [lead.district, lead.city].filter(Boolean).join(", "), lead.website].filter(Boolean).join(" · ") || "Detay yok"}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--admin-text-muted)" }}>Kaynak: {lead.source || "Bilinmiyor"} · {formatDate(lead.created_at)}</p>
          {isRejected && (
            <div className="mt-2 rounded-[10px] p-2 text-xs" style={{ background: "#FDECEC" }}>
              <p><strong>Sebep:</strong> {lead.rejection_reason || "-"}</p>
              {lead.notes && <p className="mt-1 whitespace-pre-line opacity-80">{lead.notes.split("\n").filter((l) => l.includes("Ön İnceleme İptal")).pop() || lead.notes}</p>}
              <p className="mt-1 opacity-70">{formatDate(lead.rejected_at)}</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!isRejected && onCopyCandidatePrompt && (
            <AdminButton variant="secondary" compact icon={<Sparkles size={13} />} onClick={() => onCopyCandidatePrompt(lead)}>Adayı Değerlendir Promptunu Kopyala</AdminButton>
          )}
          {!isRejected && onCopyPrompt && (
            <AdminButton variant="ai" compact icon={<Copy size={13} />} onClick={() => onCopyPrompt(lead)}>Ön İnceleme Promptunu Kopyala</AdminButton>
          )}
          {!isRejected && onReject && (
            <AdminButton variant="danger" compact onClick={() => onReject(lead)}>İptal</AdminButton>
          )}
        </div>
      </div>
    </Card>
  );
}

type Accent = "cyan" | "amber" | "blue" | "green" | "red" | "slate" | "violet";
const ACCENT: Record<Accent, { fg: string; bg: string; border: string }> = {
  cyan: { fg: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
  amber: { fg: "#92400e", bg: "#fffbeb", border: "#fde68a" },
  blue: { fg: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  green: { fg: "#166534", bg: "#f0fdf4", border: "#bbf7d0" },
  red: { fg: "#be123c", bg: "#fff1f2", border: "#fecdd3" },
  slate: { fg: "#334155", bg: "#f1f5f9", border: "#cbd5e1" },
  violet: { fg: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe" }
};

function KpiCard({ icon, label, value, note, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; note?: string; accent: Accent }) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-[16px] border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.04)] motion-safe:transition-shadow motion-safe:hover:shadow-[0_6px_18px_rgba(15,23,42,.08)]" style={{ borderColor: "var(--admin-border)" }}>
      <span className="grid size-9 place-items-center rounded-[10px]" style={{ background: ACCENT[accent].bg, color: ACCENT[accent].fg }} aria-hidden>{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[.08em] text-[#475569]">{label}</p>
        <p className="mt-1 text-[28px] font-black leading-none text-[#0f172a] tabular-nums">{value}</p>
        {note && <p className="mt-1.5 text-[13px] font-semibold leading-5 text-[#64748b]">{note}</p>}
      </div>
    </article>
  );
}

function StageCard({ icon, label, count, accent, active, onSelect }: { icon: React.ReactNode; label: string; count: number; accent: Accent; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" aria-pressed={active} onClick={onSelect} className="flex min-h-[72px] items-center gap-3 rounded-[14px] border bg-white px-4 py-3 text-left motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600" style={{ borderColor: active ? ACCENT[accent].fg : "var(--admin-border)", boxShadow: active ? `inset 0 0 0 1px ${ACCENT[accent].fg}` : undefined }}>
      <span className="grid size-10 shrink-0 place-items-center rounded-[11px]" style={{ background: ACCENT[accent].bg, color: ACCENT[accent].fg }} aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#334155]">{label}</span>
        <span className="block text-xl font-black leading-tight text-[#0f172a] tabular-nums">{count}</span>
      </span>
    </button>
  );
}

const ACTION_TONE: Record<"primary" | "neutral" | "amber" | "purple" | "green" | "danger", { bg: string; fg: string; border: string }> = {
  primary: { bg: "#0891b2", fg: "#ffffff", border: "#0891b2" },
  neutral: { bg: "#ffffff", fg: "#334155", border: "#cbd5e1" },
  amber: { bg: "#fffbeb", fg: "#92400e", border: "#fde68a" },
  purple: { bg: "#f5f3ff", fg: "#6d28d9", border: "#ddd6fe" },
  green: { bg: "#f0fdf4", fg: "#166534", border: "#bbf7d0" },
  danger: { bg: "#fff1f2", fg: "#be123c", border: "#fecdd3" }
};

function ActionButton({ icon, label, tone, onClick, disabled, busy, href }: { icon?: React.ReactNode; label: string; tone: keyof typeof ACTION_TONE; onClick?: () => void; disabled?: boolean; busy?: boolean; href?: string }) {
  const style = { background: ACTION_TONE[tone].bg, color: ACTION_TONE[tone].fg, borderColor: ACTION_TONE[tone].border };
  const className = "inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3.5 text-sm font-bold motion-safe:transition-colors hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:cursor-not-allowed disabled:opacity-50";
  if (href) return <a href={href} className={className} style={style}>{icon}{label}</a>;
  return <button type="button" onClick={onClick} disabled={disabled || busy} className={className} style={style}>{busy ? "…" : icon}{label}</button>;
}

function StatusChip({ archived }: { archived: boolean }) {
  const accent: Accent = archived ? "slate" : "green";
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black" style={{ background: ACCENT[accent].bg, color: ACCENT[accent].fg }}><span className="size-1.5 rounded-full" style={{ background: ACCENT[accent].fg }} aria-hidden />{archived ? "Arşivlendi" : "Tamamlandı"}</span>;
}

function EmptyState({ icon, title, text, ctaLabel, ctaHref }: { icon: React.ReactNode; title: string; text: string; ctaLabel?: string; ctaHref?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[16px] border border-dashed bg-white px-6 py-10 text-center" style={{ borderColor: "var(--admin-border-strong, #cbd5e1)" }}>
      <span className="grid size-12 place-items-center rounded-full bg-[#f1f5f9] text-[#475569]" aria-hidden>{icon}</span>
      <p className="text-base font-black text-[#0f172a]">{title}</p>
      <p className="max-w-md text-sm font-semibold leading-6 text-[#64748b]">{text}</p>
      {ctaLabel && ctaHref && <ActionButton tone="primary" label={ctaLabel} href={ctaHref} icon={<ArrowRight size={15} />} />}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="grid gap-3" aria-hidden>
      {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-[16px] border bg-[#f8fafc] motion-safe:animate-pulse motion-reduce:animate-none" style={{ borderColor: "var(--admin-border)" }} />)}
    </div>
  );
}

export function PreAuditCenter({ initialTab, initialLeadId }: { initialTab?: Tab; initialLeadId?: string } = {}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [leadId] = useState<string>(initialLeadId || "");
  const [autoOpenedLeadReport, setAutoOpenedLeadReport] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [reports, setReports] = useState<ListItem[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tablesReady, setTablesReady] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FullReport | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifyCompanyName, setVerifyCompanyName] = useState("");
  const [verifyCopied, setVerifyCopied] = useState(false);
  const [tab, setTab] = useState<ExtendedTab>(initialTab || "tamamlanan");
  const [candidateEvals, setCandidateEvals] = useState<CandidateEvalListItem[] | null>(null);
  const [candidateEvalDetail, setCandidateEvalDetail] = useState<Record<string, unknown> | null>(null);
  const [candidateEvalDetailLoading, setCandidateEvalDetailLoading] = useState(false);
  const [expandedCandidateEvalId, setExpandedCandidateEvalId] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "aday-degerlendirme" || candidateEvals !== null) return;
    fetch("/api/admin/candidate-evaluation").then((r) => r.json()).then((body) => setCandidateEvals(body.reports || [])).catch(() => setCandidateEvals([]));
  }, [tab, candidateEvals]);

  async function openCandidateEval(id: string) {
    if (expandedCandidateEvalId === id) { setExpandedCandidateEvalId(null); setCandidateEvalDetail(null); return; }
    setExpandedCandidateEvalId(id);
    setCandidateEvalDetail(null);
    setCandidateEvalDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/candidate-evaluation/${id}`);
      const body = await res.json();
      setCandidateEvalDetail(res.ok ? body.report : null);
    } catch {
      setCandidateEvalDetail(null);
    } finally {
      setCandidateEvalDetailLoading(false);
    }
  }
  const [queue, setQueue] = useState<Queue>({ pending: [], inReview: [], rejected: [] });
  const [promptLead, setPromptLead] = useState<QueueLead | null>(null);
  const [rejectTarget, setRejectTarget] = useState<QueueLead | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectSaving, setRejectSaving] = useState(false);
  const [offerTarget, setOfferTarget] = useState<FullReport | null>(null);
  const [offerSaving, setOfferSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("new");
  const [busyGroupId, setBusyGroupId] = useState<string>("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "" });
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [drawerGroupId, setDrawerGroupId] = useState<string | null>(null);
  useEffect(() => {
    if (!drawerGroupId) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerGroupId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerGroupId]);

  useEffect(() => {
    fetch("/api/admin/companies").then((r) => r.json()).then((body) => setCompanies(body.companies || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    setReports(null);
    try {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", companyId);
      if (leadId) params.set("leadId", leadId);
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/admin/pre-audit?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Yüklenemedi.");
      setTablesReady(body.tablesReady !== false);
      setReports(body.reports || []);
      setSummary(body.summary || null);
      setQueue(body.queue || { pending: [], inReview: [], rejected: [] });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Beklenmeyen hata.");
      setReports([]);
    }
  }, [companyId, leadId, search]);

  useEffect(() => { load(); }, [load]);

  // Lead Merkezi's "Raporu Gör" deep-link — open the lead's own latest
  // report automatically instead of making the admin search for it again.
  useEffect(() => {
    if (!leadId || autoOpenedLeadReport || !reports?.length) return;
    setAutoOpenedLeadReport(true);
    setTab("tamamlanan");
    openReport(reports[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, reports, autoOpenedLeadReport]);

  async function openReport(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/pre-audit/${id}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Rapor yüklenemedi.");
      setDetail(body.report);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setDetailLoading(false);
    }
  }

  // Real PDF/DOCX, streamed from the server — reuses the exact same
  // canonical document engine every other export in the app goes through
  // (src/lib/server/document-generator.ts, already used for proposals and
  // performance reports). No client-side PDF/DOCX generation, no browser
  // print dialog, no new AI call — the saved report is the source of truth.
  async function downloadReport(report: FullReport, format: "pdf" | "docx") {
    const key = `${report.id}-${format}`;
    setExportBusy(key);
    try {
      const response = await fetch(`/api/admin/pre-audit/${report.id}/export?format=${format}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setActionMessage(data.error || (format === "pdf" ? "PDF oluşturulamadı." : "Word belgesi oluşturulamadı."));
        return;
      }
      const disposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameMatch?.[1] || `HK-Dijital-Rapor.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setActionMessage(format === "pdf" ? "PDF oluşturulamadı." : "Word belgesi oluşturulamadı.");
    } finally {
      setExportBusy("");
    }
  }

  const companyName = companies.find((c) => c.id === companyId)?.name || "";

  async function copyVerificationPrompt() {
    const name = verifyCompanyName.trim();
    if (!name) return;
    const prompt = `${name} firmasını bul ve doğrula. Henüz ön inceleme yapma ve hiçbir şeyi HK Dijital'e kaydetme. Önce HK Dijital bağlantısından firma kaydını kontrol et ve bana hangi firmayı bulduğunu söyle.`;
    try {
      await navigator.clipboard.writeText(prompt);
      setVerifyCopied(true);
      setTimeout(() => setVerifyCopied(false), 2000);
    } catch { /* clipboard denied — nothing to fall back to here */ }
  }

  async function copyClaudePromptForLead(lead: QueueLead) {
    try {
      await navigator.clipboard.writeText(buildClaudePrompt(lead));
      setPromptLead(lead);
      fetch(`/api/admin/pre-audit/lead/${lead.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_in_progress" }) }).then(load).catch(() => {});
    } catch {
      setActionMessage("Panoya kopyalanamadı.");
    }
  }

  // Deliberately independent of copyClaudePromptForLead: never marks the
  // Ön İnceleme pre-review queue status, since Adayı Değerlendir is not
  // part of that pipeline — a candidate evaluation can happen before,
  // instead of, or without ever triggering an Ön İnceleme.
  async function copyCandidateEvaluationPromptForLead(lead: QueueLead) {
    try {
      await navigator.clipboard.writeText(buildCandidateEvaluationPrompt(lead));
      setPromptLead(lead);
    } catch {
      setActionMessage("Panoya kopyalanamadı.");
    }
  }

  const CLAUDE_URL = "https://claude.ai/new";

  /** Top-level navigation (not window.open) — the one real, non-fabricated
   * mechanism that lets the OS/browser hand this off to an installed app
   * registered as the default handler for claude.ai links, if any is. No
   * custom URI scheme is assumed or invented; if no app is registered this
   * behaves exactly like a normal link and opens the browser. */
  function openClaudeApp() {
    window.location.href = CLAUDE_URL;
    setPromptLead(null);
  }

  function openClaudeBrowser() {
    window.open(CLAUDE_URL, "_blank", "noopener,noreferrer");
    setPromptLead(null);
  }

  async function submitReject() {
    if (!rejectTarget || !rejectReason) return;
    if (rejectReason === "Diğer" && !rejectNote.trim()) { setActionMessage("'Diğer' için açıklama zorunludur."); return; }
    setRejectSaving(true);
    try {
      const res = await fetch(`/api/admin/pre-audit/lead/${rejectTarget.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reason: rejectReason, note: rejectNote })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "İptal kaydedilemedi.");
      setRejectTarget(null); setRejectReason(""); setRejectNote("");
      setActionMessage(`${leadDisplayName(rejectTarget)} iptal edildi.`);
      load();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "İptal kaydedilemedi.");
    } finally {
      setRejectSaving(false);
    }
  }

  async function sendOfferToLeadPipeline() {
    if (!offerTarget?.lead_id) return;
    setOfferSaving(true);
    try {
      const res = await fetch(`/api/admin/pre-audit/lead/${offerTarget.lead_id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_offer_lead" })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "İşlem başarısız oldu.");
      setActionMessage("Lead Merkezi'ne aktarıldı — aktif satış hunisinde devam ediyor.");
      setOfferTarget(null);
      load();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "İşlem başarısız oldu.");
    } finally {
      setOfferSaving(false);
    }
  }

  async function sendOfferToCustomer() {
    if (!offerTarget?.lead_id) return;
    setOfferSaving(true);
    try {
      const res = await fetch(`/api/admin/leads/${offerTarget.lead_id}/convert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Müşteriye dönüştürme başarısız oldu.");
      setActionMessage(`${body.company?.name || "Müşteri"} olarak kaydedildi.`);
      setOfferTarget(null);
      load();
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "Müşteriye dönüştürme başarısız oldu.");
    } finally {
      setOfferSaving(false);
    }
  }

  const sortedGroups = (groups: Array<[string, ListItem[]]>) => {
    const nameOf = ([, items]: [string, ListItem[]]) => (companies.find((c) => c.id === items[0].company_id)?.name || items[0].title || "").toLocaleLowerCase("tr");
    if (sortKey === "old") return [...groups].reverse();
    if (sortKey === "az") return [...groups].sort((a, b) => nameOf(a).localeCompare(nameOf(b), "tr"));
    if (sortKey === "za") return [...groups].sort((a, b) => nameOf(b).localeCompare(nameOf(a), "tr"));
    return groups;
  };

  async function runGroupAction(reportId: string, request: { method: "PATCH" | "DELETE"; body?: Record<string, unknown> }, success: string) {
    setBusyGroupId(reportId);
    setActionMessage(null);
    try {
      const response = await fetch(`/api/admin/pre-audit/${reportId}`, {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        body: request.body ? JSON.stringify(request.body) : undefined
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      setActionMessage(success);
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      setBusyGroupId("");
    }
  }

  async function saveGroupEdit(reportId: string) {
    await runGroupAction(reportId, { method: "PATCH", body: { title: editDraft.title } }, "Ön inceleme güncellendi.");
    setEditingGroupId(null);
  }

  function renderGroupFooter(groupId: string, first: ListItem, displayName: string, archived: boolean, options: { showView?: boolean } = {}) {
    const busy = busyGroupId === groupId;
    if (deleteGroupId === groupId) {
      return (
        <div role="alertdialog" aria-labelledby={`delete-title-${groupId}`} className="grid gap-3 rounded-[12px] border p-4" style={{ borderColor: "#fecdd3", background: "#fff1f2" }}>
          <p id={`delete-title-${groupId}`} className="text-sm font-black text-[#9f1239]">Bu ön incelemeyi kalıcı olarak silmek istediğinize emin misiniz?</p>
          <p className="text-sm font-semibold leading-6 text-[#881337]">{displayName} için Dahili ve Müşteri raporları birlikte silinir. Bu işlem geri alınamaz; emin değilseniz arşivleyebilirsiniz.</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton tone="danger" label="Kalıcı Olarak Sil" icon={<Trash2 size={15} />} busy={busy} onClick={async () => { await runGroupAction(groupId, { method: "DELETE" }, "Ön inceleme kalıcı olarak silindi."); setDeleteGroupId(null); }} />
            <ActionButton tone="neutral" label="Vazgeç" onClick={() => setDeleteGroupId(null)} disabled={busy} />
          </div>
        </div>
      );
    }
    if (editingGroupId === groupId) {
      return (
        <div className="grid gap-3 rounded-[12px] border bg-[#f8fafc] p-4" style={{ borderColor: "var(--admin-border)" }}>
          <label className="grid gap-1.5 text-sm font-bold text-[#334155]">
            Rapor başlığı
            <input value={editDraft.title} onChange={(e) => setEditDraft({ title: e.target.value })} maxLength={200} aria-invalid={!editDraft.title.trim()} className="min-h-11 rounded-[10px] border bg-white px-3.5 text-sm font-semibold text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border-strong, #cbd5e1)" }} />
          </label>
          {!editDraft.title.trim() && <p role="alert" className="text-xs font-bold text-[#be123c]">Başlık boş bırakılamaz (1–200 karakter).</p>}
          <div className="flex flex-wrap gap-2">
            <ActionButton tone="primary" label="Kaydet" busy={busy} disabled={!editDraft.title.trim()} onClick={() => saveGroupEdit(groupId)} />
            <ActionButton tone="neutral" label="Vazgeç" disabled={busy} onClick={() => setEditingGroupId(null)} />
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        {options.showView !== false && <ActionButton tone="primary" label="Görüntüle" icon={<Eye size={15} />} onClick={() => { setDrawerGroupId(groupId); openReport(first.id); }} />}
        <ActionButton tone="amber" label="Düzenle" icon={<Pencil size={15} />} disabled={busy} onClick={() => { setEditingGroupId(groupId); setEditDraft({ title: first.title || "" }); }} />
        {archived
          ? <ActionButton tone="green" label="Arşivden Çıkar" icon={<ArchiveRestore size={15} />} busy={busy} onClick={() => runGroupAction(groupId, { method: "PATCH", body: { archived: false } }, "Ön inceleme arşivden çıkarıldı.")} />
          : <ActionButton tone="purple" label="Arşivle" icon={<Archive size={15} />} busy={busy} onClick={() => runGroupAction(groupId, { method: "PATCH", body: { archived: true } }, "Ön inceleme arşivlendi.")} />}
        <span className="ml-auto" />
        <ActionButton tone="danger" label="Sil" icon={<Trash2 size={15} />} disabled={busy} onClick={() => setDeleteGroupId(groupId)} />
      </div>
    );
  }

  const grouped = useMemo(() => {
    const groups = new Map<string, ListItem[]>();
    for (const r of reports || []) {
      const list = groups.get(r.analysis_group_id) || [];
      list.push(r);
      groups.set(r.analysis_group_id, list);
    }
    return [...groups.entries()].sort((a, b) => (b[1][0]?.report_date || "").localeCompare(a[1][0]?.report_date || ""));
  }, [reports]);
  const liveGroups = useMemo(() => grouped.filter(([, items]) => !isArchivedPreAuditReport(items[0])), [grouped]);
  const archivedGroups = useMemo(() => grouped.filter(([, items]) => isArchivedPreAuditReport(items[0])), [grouped]);
  const visibleGroups = tab === "arsiv" ? archivedGroups : sortedGroups(liveGroups);

  const drawerGroup = drawerGroupId ? grouped.find(([id]) => id === drawerGroupId) || null : null;
  const drawerFirst = drawerGroup ? drawerGroup[1][0] : null;
  const drawerCompany = drawerFirst ? companies.find((c) => c.id === drawerFirst.company_id) : undefined;
  const drawerName = drawerFirst ? (drawerCompany?.name || drawerFirst.title || "Aday") : "";
  const filtersActive = Boolean(search.trim() || companyId || sortKey !== "new");
  const conversionRate = summary && summary.totalPreAudits > 0 ? `%${Math.round((summary.convertedCompanies / summary.totalPreAudits) * 100)}` : "—";
  const stages: Array<{ key: Tab; label: string; count: number; accent: Accent; icon: React.ReactNode }> = [
    { key: "bekleyen", label: "Bekleyen", count: queue.pending.length, accent: "amber", icon: <Clock size={18} /> },
    { key: "inceleniyor", label: "İnceleniyor", count: queue.inReview.length, accent: "blue", icon: <Activity size={18} /> },
    { key: "tamamlanan", label: "Tamamlanan", count: liveGroups.length, accent: "green", icon: <CheckCircle2 size={18} /> },
    { key: "iptal", label: "İptal Edilenler", count: queue.rejected.length, accent: "red", icon: <XCircle size={18} /> },
    { key: "arsiv", label: "Arşiv", count: archivedGroups.length, accent: "slate", icon: <Archive size={18} /> }
  ];
  const tabOrder: Tab[] = stages.map((stage) => stage.key);
  const emptyForTab: Record<Tab, { title: string; text: string }> = {
    bekleyen: { title: "Bekleyen ön inceleme bulunmuyor.", text: "Müşteri Keşfi'nden yeni bir firma seçerek ön inceleme sürecini başlatabilirsiniz." },
    inceleniyor: { title: "İncelemede ön inceleme yok.", text: "Bekleyen bir adayı incelemeye aldığınızda burada görünür." },
    tamamlanan: { title: companyName ? `${companyName} için henüz ön inceleme yok.` : "Henüz tamamlanmış ön inceleme yok.", text: "Müşteri Keşfi'nden bir firma seçip ön inceleme sürecini başlatın." },
    iptal: { title: "İptal edilen aday yok.", text: "Reddedilen ön incelemeler burada listelenir." },
    arsiv: { title: "Arşivlenmiş ön inceleme yok.", text: "Arşivlediğiniz raporlar burada kalır ve geri alınabilir." }
  };

  return (
    <div className="grid gap-6">
      <header className="flex flex-col gap-5 rounded-[18px] border bg-white p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between" style={{ borderColor: "var(--admin-border)" }}>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.16em] text-[#0e7490]">Satış &amp; Keşif</p>
          <h2 className="mt-1.5 text-2xl font-black text-[#0f172a]">Ön İnceleme Merkezi</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#475569]">Potansiyel müşterileri analiz edin, önceliklendirin ve satış fırsatına dönüştürün.</p>
          <p className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#475569]">
            <span className="size-2 rounded-full" style={{ background: tablesReady === false ? "#d97706" : loadError ? "#be123c" : reports === null ? "#94a3b8" : "#16a34a" }} aria-hidden />
            {tablesReady === false ? "Veri yapısı bekleniyor" : loadError ? "Veri yüklenemedi" : reports === null ? "Veriler yükleniyor" : "Veriler güncel"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <ActionButton tone="primary" label="Yeni Ön İnceleme" icon={<Plus size={16} />} href="/hk-admin/musteri-kesfi" />
          <ActionButton tone="neutral" label="Yenile" icon={<RefreshCw size={15} />} onClick={load} />
        </div>
      </header>

      {tablesReady === false && (
        <div role="status" className="rounded-[14px] border p-4 text-sm font-bold text-[#92400e]" style={{ borderColor: "#fde68a", background: "#fffbeb" }}>Ön İnceleme veri yapısı henüz etkin değil. Migration uygulanmadan bu ekran boş görünür.</div>
      )}
      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border p-4" style={{ borderColor: "#fecdd3", background: "#fff1f2" }}>
          <p className="text-sm font-bold text-[#9f1239]">Ön inceleme verileri yüklenemedi. {loadError}</p>
          <ActionButton tone="neutral" label="Tekrar dene" icon={<RefreshCw size={15} />} onClick={load} />
        </div>
      )}
      {actionMessage && <p role="status" className="rounded-[12px] border bg-[#f8fafc] px-4 py-3 text-sm font-bold text-[#334155]" style={{ borderColor: "var(--admin-border)" }}>{actionMessage}</p>}

      {summary && (
        <section aria-label="Özet" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard icon={<Layers size={18} />} label="Toplam ön inceleme" value={summary.totalPreAudits} accent="cyan" note="Tüm kayıtlı raporlar" />
          <KpiCard icon={<Gauge size={18} />} label="Bu ay" value={summary.thisMonth} accent="blue" note="Bu ayki yeni raporlar" />
          <KpiCard icon={<Building2 size={18} />} label="Potansiyel müşteriler" value={summary.potentialCompanies} accent="amber" note="Satış sürecindeki adaylar" />
          <KpiCard icon={<UserCheck size={18} />} label="Müşteriye dönüşen" value={summary.convertedCompanies} accent="green" note="Müşteri kaydına dönüşenler" />
          <KpiCard icon={<Sparkles size={18} />} label="Dönüşüm oranı" value={conversionRate} accent="violet" note={summary.totalPreAudits > 0 ? "Dönüşen ÷ toplam ön inceleme" : "Henüz ön inceleme yok"} />
        </section>
      )}

      <section aria-labelledby="pipeline-title" className="grid gap-3">
        <h3 id="pipeline-title" className="text-sm font-black uppercase tracking-[.08em] text-[#475569]">Ön İnceleme Akışı</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {stages.map((stage) => (
            <StageCard key={stage.key} icon={stage.icon} label={stage.label} count={stage.count} accent={stage.accent} active={tab === stage.key} onSelect={() => setTab(stage.key)} />
          ))}
        </div>
      </section>

      <section aria-labelledby="claude-title" className="grid gap-3 rounded-[16px] border bg-white p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center" style={{ borderColor: "var(--admin-border)" }}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="claude-title" className="text-base font-black text-[#0f172a]">Claude Firma Doğrulama</h3>
            <AdminStatusBadge tone="ai">Hazır Claude Promptu</AdminStatusBadge>
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-6 text-[#475569]">Ön İnceleme projesinde doğru firmayı HK Dijital bağlantısı üzerinden doğrulamak için hazır doğrulama promptu oluşturun.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="verify-company">Firma adı</label>
          <input id="verify-company" value={verifyCompanyName} onChange={(e) => setVerifyCompanyName(e.target.value)} placeholder="Firma adı (örn. ABC Klima)" className="min-h-11 min-w-0 flex-1 rounded-[10px] border bg-white px-3.5 text-sm font-semibold text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border-strong, #cbd5e1)" }} />
          <ActionButton tone="neutral" label={verifyCopied ? "Prompt kopyalandı ✓" : "Promptu Kopyala"} icon={<Copy size={15} />} disabled={!verifyCompanyName.trim()} onClick={copyVerificationPrompt} />
        </div>
      </section>

      <section aria-label="Arama ve filtreler" className="flex flex-wrap items-center gap-2 rounded-[14px] border bg-white p-3" style={{ borderColor: "var(--admin-border)" }}>
        <div className="relative">
          <button type="button" aria-haspopup="listbox" aria-expanded={pickerOpen} onClick={() => setPickerOpen((v) => !v)} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border bg-white px-3.5 text-sm font-bold text-[#334155] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border-strong, #cbd5e1)" }}>
            <Building2 size={15} aria-hidden /> {companyName || "Tüm firmalar"} <ChevronDown size={15} aria-hidden />
          </button>
          {pickerOpen && (
            <div role="listbox" className="absolute z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-[12px] border bg-white p-1 shadow-lg" style={{ borderColor: "var(--admin-border)" }}>
              <button type="button" role="option" aria-selected={!companyId} onClick={() => { setCompanyId(""); setPickerOpen(false); }} className="block w-full rounded-[8px] px-3 py-2 text-left text-sm font-bold hover:bg-[#f1f5f9]">Tüm firmalar</button>
              {companies.map((c) => (
                <button key={c.id} type="button" role="option" aria-selected={companyId === c.id} onClick={() => { setCompanyId(c.id); setPickerOpen(false); }} className="block w-full rounded-[8px] px-3 py-2 text-left text-sm font-bold hover:bg-[#f1f5f9]">{c.name}</button>
              ))}
            </div>
          )}
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748b]" aria-hidden />
          <label className="sr-only" htmlFor="pre-audit-search">Firma veya rapor ara</label>
          <input id="pre-audit-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Firma veya rapor ara…" className="min-h-11 w-full rounded-[10px] border bg-white pl-10 pr-3.5 text-sm font-semibold text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border-strong, #cbd5e1)" }} />
        </div>
        <label className="sr-only" htmlFor="pre-audit-sort">Sıralama</label>
        <select id="pre-audit-sort" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="min-h-11 rounded-[10px] border bg-white px-3 text-sm font-bold text-[#334155] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border-strong, #cbd5e1)" }}>
          <option value="new">En yeni</option>
          <option value="old">En eski</option>
          <option value="az">Firma A-Z</option>
          <option value="za">Firma Z-A</option>
        </select>
        {filtersActive && <ActionButton tone="neutral" label="Filtreleri temizle" onClick={() => { setSearch(""); setCompanyId(""); setSortKey("new"); }} />}
      </section>

      <div role="tablist" aria-label="Ön inceleme durumları" className="premium-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {stages.map((stage) => {
          const active = tab === stage.key;
          return (
            <button key={stage.key} id={`tab-${stage.key}`} role="tab" type="button" aria-selected={active} aria-controls="pre-audit-panel" tabIndex={active ? 0 : -1} onClick={() => setTab(stage.key)} onKeyDown={(e) => {
              if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
              const next = tabOrder[(tabOrder.indexOf(tab as Tab) + (e.key === "ArrowRight" ? 1 : -1) + tabOrder.length) % tabOrder.length];
              setTab(next);
              document.getElementById(`tab-${next}`)?.focus();
            }} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-black motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600" style={active ? { background: "#0f172a", color: "#ffffff" } : { background: "#f1f5f9", color: "#334155" }}>
              {stage.label}
              <span className="rounded-full px-2 py-0.5 text-xs font-black tabular-nums" style={active ? { background: "#ffffff1f", color: "#ffffff" } : { background: "#ffffff", color: "#334155" }}>{stage.count}</span>
            </button>
          );
        })}
        <button
          id="tab-aday-degerlendirme" role="tab" type="button" aria-selected={tab === "aday-degerlendirme"} aria-controls="pre-audit-panel"
          onClick={() => setTab("aday-degerlendirme")}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-black motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600"
          style={tab === "aday-degerlendirme" ? { background: "#0f172a", color: "#ffffff" } : { background: "#f1f5f9", color: "#334155" }}
        >
          <Sparkles size={15} aria-hidden /> Aday Değerlendirme
          <span className="rounded-full px-2 py-0.5 text-xs font-black tabular-nums" style={tab === "aday-degerlendirme" ? { background: "#ffffff1f", color: "#ffffff" } : { background: "#ffffff", color: "#334155" }}>{candidateEvals?.length ?? 0}</span>
        </button>
      </div>

      <section id="pre-audit-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="grid gap-3">
        {reports === null && !loadError && tab !== "bekleyen" && tab !== "inceleniyor" && tab !== "iptal" && <SkeletonRows />}

        {tab === "bekleyen" && (
          queue.pending.length
            ? <div className="grid gap-3">{queue.pending.map((lead) => <QueueLeadRow key={lead.id} lead={lead} onCopyPrompt={copyClaudePromptForLead} onCopyCandidatePrompt={copyCandidateEvaluationPromptForLead} onReject={setRejectTarget} />)}</div>
            : <EmptyState icon={<Inbox size={22} />} title={emptyForTab.bekleyen.title} text={emptyForTab.bekleyen.text} ctaLabel="Müşteri Keşfi'ne Git" ctaHref="/hk-admin/musteri-kesfi" />
        )}
        {tab === "inceleniyor" && (
          queue.inReview.length
            ? <div className="grid gap-3">{queue.inReview.map((lead) => <QueueLeadRow key={lead.id} lead={lead} onCopyPrompt={copyClaudePromptForLead} onCopyCandidatePrompt={copyCandidateEvaluationPromptForLead} onReject={setRejectTarget} />)}</div>
            : <EmptyState icon={<Activity size={22} />} title={emptyForTab.inceleniyor.title} text={emptyForTab.inceleniyor.text} />
        )}
        {tab === "iptal" && (
          queue.rejected.length
            ? <div className="grid gap-3">{queue.rejected.map((lead) => <QueueLeadRow key={lead.id} lead={lead} isRejected />)}</div>
            : <EmptyState icon={<XCircle size={22} />} title={emptyForTab.iptal.title} text={emptyForTab.iptal.text} />
        )}

        {tab === "aday-degerlendirme" && (
          candidateEvals === null
            ? <SkeletonRows />
            : candidateEvals.length === 0
              ? <EmptyState icon={<Sparkles size={22} />} title="Henüz görüntülenecek rapor bulunmuyor." text="Bekleyen/İnceleniyor adaylarda “Adayı Değerlendir Promptunu Kopyala” ile yeni bir değerlendirme başlatabilirsiniz." />
              : <div className="grid gap-3">
                  {candidateEvals.map((item) => (
                    <Card key={item.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black">{item.title || "İsimsiz aday"}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-bold" style={{ color: "var(--admin-text-muted, #64748b)" }}>
                            {item.recommendation && <AdminStatusBadge tone={item.recommendation.toLocaleLowerCase("tr").includes("değil") ? "danger" : "success"}>{item.recommendation}</AdminStatusBadge>}
                            {item.priority && <AdminStatusBadge tone="info">{item.priority}</AdminStatusBadge>}
                            {typeof item.score === "number" && <span>Puan: {item.score}/100</span>}
                            <span>{formatDate(item.report_date)}</span>
                          </p>
                        </div>
                        <AdminButton variant="secondary" compact icon={<Eye size={13} />} onClick={() => openCandidateEval(item.id)}>{expandedCandidateEvalId === item.id ? "Gizle" : "Detay"}</AdminButton>
                      </div>
                      {expandedCandidateEvalId === item.id && (
                        <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--admin-border)" }}>
                          {candidateEvalDetailLoading
                            ? <p className="text-sm" style={{ color: "var(--admin-text-muted, #64748b)" }}>Yükleniyor…</p>
                            : <CandidateEvaluationDetail report={candidateEvalDetail} />}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
        )}

        {(tab === "tamamlanan" || tab === "arsiv") && reports !== null && (
          visibleGroups.length === 0
            ? <EmptyState icon={<Inbox size={22} />} title={emptyForTab[tab].title} text={emptyForTab[tab].text} ctaLabel={tab === "tamamlanan" ? "Müşteri Keşfi'ne Git" : undefined} ctaHref={tab === "tamamlanan" ? "/hk-admin/musteri-kesfi" : undefined} />
            : visibleGroups.map(([groupId, items]) => {
                const first = items[0];
                const company = companies.find((c) => c.id === first.company_id);
                const displayName = company?.name || first.title || "Aday";
                const archived = tab === "arsiv";
                const updated = isMeaningfullyUpdated(first.created_at, first.updated_at);
                return (
                  <article key={groupId} className="grid gap-4 rounded-[16px] border bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04)] motion-safe:transition-shadow motion-safe:hover:shadow-[0_6px_18px_rgba(15,23,42,.08)]" style={{ borderColor: "var(--admin-border)" }}>
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="min-w-0 truncate text-base font-black text-[#0f172a]" title={displayName}>{displayName}</h4>
                          <StatusChip archived={archived} />
                          {!company && <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-bold text-[#475569]">Lead</span>}
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-[#475569]" title={first.title || ""}>{first.title || "Başlıksız rapor"}</p>
                        <p className="mt-2 text-xs font-semibold text-[#64748b]">
                          Oluşturuldu {formatDateTime(first.created_at)}
                          {updated && <> · Güncellendi {formatDateTime(first.updated_at)}</>}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end" role="group" aria-label="Rapor erişimi">
                        {items.map((r) => (
                          <button key={r.id} type="button" onClick={() => openReport(r.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border px-3 text-sm font-bold text-[#334155] motion-safe:transition-colors hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border-strong, #cbd5e1)" }}>
                            <Eye size={15} aria-hidden />
                            {r.report_type === "INTERNAL_REPORT" ? "Dahili Rapor" : "Müşteri Raporu"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="border-t pt-4" style={{ borderColor: "var(--admin-border)" }}>
                      {renderGroupFooter(groupId, first, displayName, archived)}
                    </div>
                  </article>
                );
              })
        )}
      </section>

      {drawerGroup && drawerFirst && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-[#0f172a]/40" onMouseDown={() => setDrawerGroupId(null)}>
          <aside role="dialog" aria-modal="true" aria-labelledby="pre-audit-drawer-title" className="flex h-full w-full max-w-[min(640px,100vw)] flex-col overflow-hidden bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-4 border-b p-6" style={{ borderColor: "var(--admin-border)" }}>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[.16em] text-[#0e7490]">Ön İnceleme</p>
                <h2 id="pre-audit-drawer-title" className="mt-1 truncate text-xl font-black text-[#0f172a]" title={drawerName}>{drawerName}</h2>
                <p className="mt-1 truncate text-sm font-semibold text-[#475569]">{drawerFirst.title || "Başlıksız rapor"}</p>
                <div className="mt-3"><StatusChip archived={tab === "arsiv" || isArchivedPreAuditReport(drawerFirst)} /></div>
              </div>
              <button type="button" onClick={() => setDrawerGroupId(null)} aria-label="Kapat" autoFocus className="grid size-11 shrink-0 place-items-center rounded-[10px] border text-[#334155] hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border-strong, #cbd5e1)" }}><X size={18} aria-hidden /></button>
            </header>
            <div className="grid flex-1 content-start gap-6 overflow-y-auto p-6">
              <section aria-labelledby="drawer-info" className="grid gap-3">
                <h3 id="drawer-info" className="text-xs font-black uppercase tracking-[.08em] text-[#475569]">Bilgiler</h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[12px] border p-3.5" style={{ borderColor: "var(--admin-border)" }}><dt className="text-xs font-bold text-[#64748b]">Oluşturulma</dt><dd className="mt-1 text-sm font-bold text-[#0f172a]">{formatDateTime(drawerFirst.created_at)}</dd></div>
                  <div className="rounded-[12px] border p-3.5" style={{ borderColor: "var(--admin-border)" }}><dt className="text-xs font-bold text-[#64748b]">Son güncelleme</dt><dd className="mt-1 text-sm font-bold text-[#0f172a]">{isMeaningfullyUpdated(drawerFirst.created_at, drawerFirst.updated_at) ? formatDateTime(drawerFirst.updated_at) : "Güncelleme yok"}</dd></div>
                  <div className="rounded-[12px] border p-3.5" style={{ borderColor: "var(--admin-border)" }}><dt className="text-xs font-bold text-[#64748b]">Firma</dt><dd className="mt-1 text-sm font-bold text-[#0f172a]">{drawerCompany?.name || "Lead kaydı"}</dd></div>
                  <div className="rounded-[12px] border p-3.5" style={{ borderColor: "var(--admin-border)" }}><dt className="text-xs font-bold text-[#64748b]">Rapor sayısı</dt><dd className="mt-1 text-sm font-bold text-[#0f172a]">{drawerGroup[1].length}</dd></div>
                </dl>
              </section>
              <section aria-labelledby="drawer-reports" className="grid gap-3">
                <h3 id="drawer-reports" className="text-xs font-black uppercase tracking-[.08em] text-[#475569]">Raporlar</h3>
                <div className="flex flex-wrap gap-2">
                  {drawerGroup[1].map((r) => (
                    <button key={r.id} type="button" onClick={() => openReport(r.id)} className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-4 text-sm font-bold text-[#334155] hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border-strong, #cbd5e1)" }}>
                      <Eye size={15} aria-hidden />{r.report_type === "INTERNAL_REPORT" ? "Dahili Raporu Aç" : "Müşteri Raporunu Aç"}
                    </button>
                  ))}
                </div>
                {detailLoading && <p className="text-sm font-semibold text-[#64748b]">Rapor yükleniyor…</p>}
                {detail && detail.analysis_group_id === drawerGroupId && !detailLoading && (
                  <div className="rounded-[12px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
                    {detail && <ReportDetail report={detail} onSendOffer={setOfferTarget} onReject={(r) => setRejectTarget({ id: r.lead_id!, company: r.title, name: null, sector: null, business_type: null, city: null, district: null, website: null, phone: null, instagram: null, status: null, rejection_reason: null, rejected_at: null, notes: null, google_place_id: null, source: null, created_at: "" })} onExport={downloadReport} exportBusy={exportBusy} />}
                  </div>
                )}
              </section>
              <section aria-labelledby="drawer-actions" className="grid gap-3">
                <h3 id="drawer-actions" className="text-xs font-black uppercase tracking-[.08em] text-[#475569]">Hızlı İşlemler</h3>
                {renderGroupFooter(drawerGroupId!, drawerFirst, drawerName, tab === "arsiv" || isArchivedPreAuditReport(drawerFirst), { showView: false })}
              </section>
            </div>
          </aside>
        </div>
      )}

      {promptLead && (
        <Modal title="Prompt kopyalandı" onClose={() => setPromptLead(null)}>
          <p className="text-sm">Claude&apos;u nasıl açmak istersiniz?</p>
          <div className="mt-4 grid gap-2">
            <AdminButton variant="ai" icon={<ExternalLink size={14} />} onClick={openClaudeApp}>Claude App&apos;te Aç</AdminButton>
            <p className="text-[11px]" style={{ color: "var(--admin-text-muted)" }}>Bilgisayarınızda Claude masaüstü uygulaması varsayılan olarak ayarlıysa açılır; değilse tarayıcıda açılır.</p>
            <AdminButton variant="secondary" icon={<ExternalLink size={14} />} onClick={openClaudeBrowser}>Tarayıcıda Aç</AdminButton>
            <AdminButton variant="ghost" onClick={() => setPromptLead(null)}>Vazgeç</AdminButton>
          </div>
        </Modal>
      )}

      {offerTarget && (
        <Modal title="Bu işletme nereye kaydedilsin?" onClose={() => !offerSaving && setOfferTarget(null)}>
          <div className="grid gap-2">
            <AdminButton variant="success" loading={offerSaving} onClick={sendOfferToLeadPipeline}>Lead Merkezi</AdminButton>
            <AdminButton variant="warning" loading={offerSaving} onClick={sendOfferToCustomer}>Müşteriler</AdminButton>
            <p className="text-xs font-bold" style={{ color: "#b45309" }}>Müşteriler seçeneği yalnızca sözleşme/teklif kabul edilmiş gerçek müşteriler için kullanılmalıdır — doğrudan aktif müşteri kaydı oluşturur.</p>
            <AdminButton variant="ghost" disabled={offerSaving} onClick={() => setOfferTarget(null)}>Vazgeç</AdminButton>
          </div>
        </Modal>
      )}

      {rejectTarget && (
        <Modal title="İptal sebebi" onClose={() => !rejectSaving && setRejectTarget(null)}>
          <div className="grid gap-2">
            <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="rounded-[10px] border p-2.5 text-sm font-bold" style={{ borderColor: "var(--admin-border)" }}>
              <option value="">Seçin…</option>
              {REJECTION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder={rejectReason === "Diğer" ? "Açıklama (zorunlu)" : "Not / açıklama (opsiyonel)"} rows={3} className="rounded-[10px] border p-2.5 text-sm" style={{ borderColor: "var(--admin-border)" }} />
            <div className="flex justify-end gap-2">
              <AdminButton variant="secondary" disabled={rejectSaving} onClick={() => setRejectTarget(null)}>Vazgeç</AdminButton>
              <AdminButton variant="danger" loading={rejectSaving} disabled={!rejectReason} onClick={submitReject}>İptal Et</AdminButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-change pattern, same accepted precedent as AdEvaluationPanel.tsx */

// Rapor Merkezi V2 — report-first flow over every real stored report:
//   1 Kategori → 2 Rapor türü → 3 Kayıt kaynağı (Lead / Müşteri) →
//   4 Lead Seç / Müşteri Seç → 5 İşletme / Şube → 6 Raporlar → 7 Aç / önizle / indir.
// All filtering and authorization happens server-side (/api/admin/report-center/v2/*);
// this screen never receives a report that does not belong to the selected record.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Building2, ChevronDown, Download, Eye, FileText, FileType2, History, RefreshCw, Search, UserRound, Users, X } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge, type AdminStatusTone } from "@/components/admin/ui/AdminStatusBadge";
import { AdminEmptyState, AdminErrorState, AdminLoadingState } from "@/components/admin/ui/AdminEmptyState";
import { ReportDocumentView } from "@/components/admin/report-center/ReportDocumentView";
import { forceTextColor } from "@/lib/admin-style";
import { formatDateTr } from "@/lib/report-design";
import type { DocumentPayload } from "@/lib/document-model";
import {
  VARIANT_LABELS, ownerSupportLabel,
  type ReportCategoryKey, type ReportOwnerType, type ReportTypeDefinition, type ReportTypeKey, type ReportVariant
} from "@/lib/report-center-v2/catalog";

const LegacyReportCenterPanel = dynamic(
  () => import("@/components/admin/report-center/LegacyReportCenterPanel").then((m) => m.LegacyReportCenterPanel),
  { ssr: false, loading: () => <AdminLoadingState label="Klasik görünüm yükleniyor…" /> }
);

const API = "/api/admin/report-center/v2";

type Category = { key: ReportCategoryKey; label: string; description: string };
type Owner = { id: string; name: string; detail: string | null };
type Business = { id: string; name: string; relationship: string };
type ReportItem = {
  ref: string; type: ReportTypeKey; sourceId: string; title: string; subtitle: string | null; date: string | null; period: string | null;
  status: string | null; statusLabel: string | null; archived: boolean; businessName: string | null; businessUnitId: string | null;
  variants: ReportVariant[]; formats: { pdf: boolean; docx: boolean }; storedFile: boolean;
};
type ReportDetail = {
  title: string; variant: ReportVariant; variants: ReportVariant[]; storedFile: boolean; hasStoredFile: boolean; empty: boolean;
  document: Omit<DocumentPayload, "clientLogo">;
};
type Notify = (message: string, type?: string) => void;

const OWNER_LABELS: Record<ReportOwnerType, { pick: string; source: string; empty: string }> = {
  lead: { pick: "LEAD SEÇ", source: "Lead", empty: "Aramanızla eşleşen lead bulunamadı." },
  company: { pick: "MÜŞTERİ SEÇ", source: "Müşteri", empty: "Aramanızla eşleşen müşteri bulunamadı." }
};

const STATUS_TONE: Record<string, AdminStatusTone> = {
  approved: "success", active: "success", completed: "success", evaluated: "success", submitted: "info",
  draft: "neutral", updated: "info", archived: "warning", partial: "warning", failed: "danger"
};

/** Source module of each type (the original screens stay untouched). */
const SOURCE_HREF: Partial<Record<ReportTypeKey, string>> = {
  pre_audit_internal: "/hk-admin/on-inceleme", pre_audit_client: "/hk-admin/on-inceleme", candidate_evaluation: "/hk-admin/on-inceleme",
  instagram_evaluation: "/hk-admin/ad-insights", manual_evaluation: "/hk-admin/ad-insights", ad_evaluation: "/hk-admin/ad-insights",
  ad_strategy: "/hk-admin/ad-insights", ad_creative_report: "/hk-admin/ad-insights",
  instagram_profile_audit: "/hk-admin/analiz-raporlama", analytics_report: "/hk-admin/analiz-raporlama",
  proposal: "/hk-admin/teklif-merkezi", gemini_visibility: "/hk-admin/growth-intelligence", content_plan: "/hk-admin/social-autopilot"
};

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "İşlem tamamlanamadı.");
  return body as T;
}

function fileNameFrom(header: string | null, fallback: string) {
  if (!header) return fallback;
  const star = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try { return decodeURIComponent(star[1]); } catch { /* fall through */ }
  }
  return header.match(/filename="([^"]+)"/i)?.[1] || fallback;
}

function StepCard({ step, title, hint, done, children, testId }: { step: number; title: string; hint?: string; done?: boolean; children: React.ReactNode; testId?: string }) {
  return (
    <section className="admin-card min-w-0 rounded-[18px] p-4 sm:p-5" data-testid={testId} aria-label={`Adım ${step}: ${title}`}>
      <div className="mb-3 flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full text-xs font-black" style={forceTextColor(done ? { background: "#11AFA8", color: "#FFFFFF" } : { background: "var(--admin-surface-soft, #eef2f6)", color: "var(--admin-text-secondary)" })}>{step}</span>
        <div className="min-w-0">
          <h3 className="text-sm font-black uppercase tracking-[.08em]" style={forceTextColor({ color: "var(--admin-text-primary)" })}>{title}</h3>
          {hint && <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--admin-text-muted)" }}>{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function ChoiceButton({ active, disabled, onClick, children, description, testId }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode; description?: string; testId?: string }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-pressed={active} data-testid={testId}
      className="min-w-0 rounded-[14px] border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50"
      style={{ borderColor: active ? "#11AFA8" : "var(--admin-border)", background: active ? "rgba(17,175,168,.08)" : "var(--admin-surface)", boxShadow: active ? "0 0 0 1px #11AFA8 inset" : undefined }}
    >
      <span className="block text-sm font-black" style={forceTextColor({ color: "var(--admin-text-primary)" })}>{children}</span>
      {description && <span className="mt-1 block text-xs leading-5" style={{ color: "var(--admin-text-muted)" }}>{description}</span>}
    </button>
  );
}

/** Searchable owner dropdown. Leads and customers are separate lists that
 * are never merged; results come from the server (owner list endpoint). */
function OwnerPicker({ ownerType, value, onChange }: { ownerType: ReportOwnerType; value: Owner | null; onChange: (owner: Owner | null) => void }) {
  const labels = OWNER_LABELS[ownerType];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Owner[] | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const listId = `report-owner-${ownerType}-list`;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setError("");
      fetch(`${API}/owners?type=${ownerType}&q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((r) => readJson<{ owners: Owner[] }>(r))
        .then((body) => { setOptions(body.owners); setActive(0); })
        .catch((e) => { if (!controller.signal.aborted) { setOptions([]); setError(e instanceof Error ? e.message : "Kayıtlar yüklenemedi."); } });
    }, query ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [open, query, ownerType]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function choose(owner: Owner) {
    onChange(owner);
    setOpen(false);
    setQuery("");
  }

  if (value && !open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border p-3" style={{ borderColor: "#11AFA8", background: "rgba(17,175,168,.06)" }} data-testid={`selected-${ownerType}`}>
        <div className="flex min-w-0 items-center gap-3">
          {ownerType === "lead" ? <UserRound size={18} style={{ color: "#0B7B76" }} /> : <Users size={18} style={{ color: "#0B7B76" }} />}
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[.14em]" style={forceTextColor({ color: "#0B7B76" })}>{labels.source.toLocaleUpperCase("tr")}</p>
            <p className="truncate text-sm font-black" style={forceTextColor({ color: "var(--admin-text-primary)" })}>{value.name}</p>
            {value.detail && <p className="truncate text-xs" style={{ color: "var(--admin-text-muted)" }}>{value.detail}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <AdminButton variant="secondary" compact onClick={() => setOpen(true)}>Değiştir</AdminButton>
          <AdminButton variant="ghost" compact icon={<X size={14} />} onClick={() => onChange(null)}>Temizle</AdminButton>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapper} className="relative">
      <label className="sr-only" htmlFor={`${listId}-input`}>{labels.pick}</label>
      <div className="flex min-h-11 items-center gap-2 rounded-[14px] border px-3" style={{ borderColor: open ? "#11AFA8" : "var(--admin-border)", background: "var(--admin-surface)" }}>
        <Search size={16} style={{ color: "var(--admin-text-muted)" }} />
        <input
          id={`${listId}-input`} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
          aria-activedescendant={open && options?.[active] ? `${listId}-${options[active].id}` : undefined}
          value={query} placeholder={ownerType === "lead" ? "Lead adı veya firma ara…" : "Müşteri adı ara…"}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min((options?.length || 1) - 1, i + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            if (e.key === "Enter" && open && options?.[active]) { e.preventDefault(); choose(options[active]); }
            if (e.key === "Escape") setOpen(false);
          }}
          className="w-full min-w-0 bg-transparent text-sm font-bold outline-none" style={{ color: "var(--admin-text-primary)" }}
        />
        <ChevronDown size={16} style={{ color: "var(--admin-text-muted)" }} />
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-label={labels.pick} className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-[14px] border p-1 shadow-lg" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
          {options === null && <li className="p-3 text-sm" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor…</li>}
          {error && <li className="p-3 text-sm" style={{ color: "#B42318" }}>{error}</li>}
          {options && !error && options.length === 0 && <li className="p-3 text-sm" style={{ color: "var(--admin-text-muted)" }}>{labels.empty}</li>}
          {options?.map((owner, index) => (
            <li
              key={owner.id} id={`${listId}-${owner.id}`} role="option" aria-selected={index === active}
              onMouseDown={(e) => e.preventDefault()} onClick={() => choose(owner)} onMouseEnter={() => setActive(index)}
              className="cursor-pointer rounded-[10px] px-3 py-2"
              style={{ background: index === active ? "rgba(17,175,168,.10)" : undefined }}
            >
              <span className="block text-sm font-bold" style={{ color: "var(--admin-text-primary)" }}>{owner.name}</span>
              {owner.detail && <span className="block text-xs" style={{ color: "var(--admin-text-muted)" }}>{owner.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function reportParams(typeKey: ReportTypeKey, ownerType: ReportOwnerType, ownerId: string, business: string) {
  return new URLSearchParams({ type: typeKey, ownerType, ownerId, business });
}

function ReportDetailDrawer({
  item, typeDef, ownerType, owner, business, initialVariant, onClose, onPreview, onDownload, busy
}: {
  item: ReportItem; typeDef: ReportTypeDefinition; ownerType: ReportOwnerType; owner: Owner; business: string; initialVariant: ReportVariant;
  onClose: () => void; onPreview: (item: ReportItem, variant: ReportVariant) => void; onDownload: (item: ReportItem, variant: ReportVariant, format: "pdf" | "docx") => void; busy: string;
}) {
  const [variant, setVariant] = useState<ReportVariant>(initialVariant);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setDetail(null);
    setError("");
    const params = reportParams(item.type, ownerType, owner.id, business);
    params.set("id", item.sourceId);
    params.set("variant", variant);
    fetch(`${API}/report?${params}`, { signal: controller.signal })
      .then((r) => readJson<ReportDetail>(r))
      .then(setDetail)
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Rapor görüntülenemedi."); });
    return () => controller.abort();
  }, [item, ownerType, owner.id, business, variant]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pdfAvailable = item.formats.pdf && (!item.storedFile || detail?.hasStoredFile !== false);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Rapor: ${item.title}`} data-testid="report-detail">
      <button type="button" aria-label="Kapat" className="absolute inset-0 cursor-default" style={{ background: "rgba(15,23,42,.45)" }} onClick={onClose} />
      <div className="relative flex h-full w-full max-w-4xl flex-col shadow-2xl" style={{ background: "var(--admin-bg, var(--admin-surface))" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[.14em]" style={forceTextColor({ color: "#0B7B76" })}>{typeDef.label.toLocaleUpperCase("tr")}</p>
            <h2 className="truncate text-base font-black" style={forceTextColor({ color: "var(--admin-text-primary)" })}>{item.title}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {item.variants.length > 1 && (
              <div className="flex rounded-full border p-0.5" role="group" aria-label="Rapor sürümü" style={{ borderColor: "var(--admin-border)" }}>
                {item.variants.map((v) => (
                  <button key={v} type="button" aria-pressed={variant === v} onClick={() => setVariant(v)} className="rounded-full px-3 py-1 text-xs font-black"
                    style={forceTextColor(variant === v ? { background: "#10243A", color: "#FFFFFF" } : { color: "var(--admin-text-secondary)" })}>{VARIANT_LABELS[v]}</button>
                ))}
              </div>
            )}
            {pdfAvailable && <AdminButton variant="info" compact icon={<Eye size={14} />} loading={busy === `${item.ref}:${variant}:preview`} onClick={() => onPreview(item, variant)}>PDF Önizle</AdminButton>}
            {pdfAvailable && <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={busy === `${item.ref}:${variant}:pdf`} onClick={() => onDownload(item, variant, "pdf")}>PDF İndir</AdminButton>}
            {item.formats.docx && <AdminButton variant="secondary" compact icon={<FileType2 size={14} />} loading={busy === `${item.ref}:${variant}:docx`} onClick={() => onDownload(item, variant, "docx")}>Word İndir</AdminButton>}
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Raporu kapat" className="grid size-9 place-items-center rounded-full border" style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-primary)" }}><X size={16} /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {variant === "internal" && <p className="mb-3 rounded-[10px] p-2.5 text-xs font-bold" style={{ background: "#FFF4E5", color: "#8A4B00" }}>Dahili rapor — satış notları ve iç değerlendirmeler içerir; müşteriyle paylaşmayın.</p>}
          {!detail && !error && <AdminLoadingState label="Rapor içeriği yükleniyor…" />}
          {error && <AdminErrorState title="Rapor açılamadı" description={error} />}
          {detail && detail.empty && (
            <AdminEmptyState
              title="Bu raporda görüntülenecek içerik bulunmuyor"
              description={detail.storedFile ? (detail.hasStoredFile ? "Bu raporun içeriği kayıtlı PDF dosyasındadır. PDF Önizle ile açabilirsiniz." : "Bu rapor için kayıtlı PDF dosyası da bulunamadı.") : "Rapor kaydı var ancak içerik alanları boş. Kaynak modülde raporu tamamlayabilirsiniz."}
            />
          )}
          {detail && !detail.empty && <ReportDocumentView document={detail.document} />}
          {SOURCE_HREF[item.type] && (
            <a href={SOURCE_HREF[item.type]} className="mt-6 inline-flex items-center gap-1 text-xs font-bold underline" style={{ color: "#0B7B76" }}>
              <FileText size={12} /> Kaynak modülde aç
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportCard({
  item, typeDef, categoryLabel, ownerName, variant, onVariant, onView, onPreview, onDownload, busy
}: {
  item: ReportItem; typeDef: ReportTypeDefinition; categoryLabel: string; ownerName: string; variant: ReportVariant;
  onVariant: (v: ReportVariant) => void; onView: () => void; onPreview: () => void; onDownload: (format: "pdf" | "docx") => void; busy: string;
}) {
  const date = formatDateTr(item.date);
  return (
    <article className="admin-card min-w-0 rounded-[16px] p-4" data-testid="report-card" aria-label={item.title}>
      <div className="flex flex-wrap items-center gap-2">
        <AdminStatusBadge tone="neutral">{categoryLabel}</AdminStatusBadge>
        <AdminStatusBadge tone="info">{typeDef.label}</AdminStatusBadge>
        {item.statusLabel && <AdminStatusBadge tone={STATUS_TONE[item.status || ""] || "neutral"}>{item.statusLabel}</AdminStatusBadge>}
        {item.variants.length === 1 && item.variants[0] === "internal" && <AdminStatusBadge tone="warning">Dahili</AdminStatusBadge>}
      </div>
      <h4 className="mt-2 break-words text-base font-black" style={forceTextColor({ color: "var(--admin-text-primary)" })}>{item.title}</h4>
      {item.subtitle && <p className="mt-0.5 text-xs" style={{ color: "var(--admin-text-muted)" }}>{item.subtitle}</p>}
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        <div className="flex gap-1"><dt style={{ color: "var(--admin-text-muted)" }}>İşletme:</dt><dd className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{item.businessName ? `${item.businessName} (${ownerName})` : ownerName}</dd></div>
        <div className="flex gap-1"><dt style={{ color: "var(--admin-text-muted)" }}>Oluşturulma:</dt><dd className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{date || "—"}</dd></div>
        {item.period && <div className="flex gap-1"><dt style={{ color: "var(--admin-text-muted)" }}>Dönem:</dt><dd className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{item.period}</dd></div>}
        <div className="flex gap-1"><dt style={{ color: "var(--admin-text-muted)" }}>Formatlar:</dt><dd className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{[item.formats.pdf && "PDF", item.formats.docx && "Word"].filter(Boolean).join(" · ") || "Yalnızca ekranda"}</dd></div>
      </dl>
      {item.variants.length > 1 && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span style={{ color: "var(--admin-text-muted)" }}>Sürüm:</span>
          <div className="flex rounded-full border p-0.5" role="group" aria-label="Rapor sürümü" style={{ borderColor: "var(--admin-border)" }}>
            {item.variants.map((v) => (
              <button key={v} type="button" aria-pressed={variant === v} onClick={() => onVariant(v)} className="rounded-full px-3 py-1 text-xs font-black"
                style={forceTextColor(variant === v ? { background: "#10243A", color: "#FFFFFF" } : { color: "var(--admin-text-secondary)" })}>{VARIANT_LABELS[v]}</button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <AdminButton variant="primary" compact icon={<Eye size={14} />} onClick={onView}>Raporu Görüntüle</AdminButton>
        {item.formats.pdf && <AdminButton variant="info" compact icon={<FileText size={14} />} loading={busy === `${item.ref}:${variant}:preview`} onClick={onPreview}>PDF Önizle</AdminButton>}
        {item.formats.pdf && <AdminButton variant="secondary" compact icon={<Download size={14} />} loading={busy === `${item.ref}:${variant}:pdf`} onClick={() => onDownload("pdf")}>PDF İndir</AdminButton>}
        {item.formats.docx && <AdminButton variant="secondary" compact icon={<FileType2 size={14} />} loading={busy === `${item.ref}:${variant}:docx`} onClick={() => onDownload("docx")}>Word İndir</AdminButton>}
      </div>
    </article>
  );
}

export function ReportCenterPanel({ content, notify }: { content?: unknown; notify?: Notify }) {
  const [view, setView] = useState<"v2" | "legacy">("v2");
  const [catalog, setCatalog] = useState<{ categories: Category[]; types: ReportTypeDefinition[] } | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [category, setCategory] = useState<ReportCategoryKey | "">("");
  const [typeKey, setTypeKey] = useState<ReportTypeKey | "">("");
  const [ownerType, setOwnerType] = useState<ReportOwnerType | "">("");
  const [lead, setLead] = useState<Owner | null>(null);
  const [company, setCompany] = useState<Owner | null>(null);
  const [businesses, setBusinesses] = useState<Business[] | null>(null);
  const [business, setBusiness] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [items, setItems] = useState<ReportItem[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [variants, setVariants] = useState<Record<string, ReportVariant>>({});
  const [viewing, setViewing] = useState<ReportItem | null>(null);
  const [busy, setBusy] = useState("");

  const owner = ownerType === "lead" ? lead : ownerType === "company" ? company : null;
  const typeDef = useMemo(() => catalog?.types.find((t) => t.key === typeKey) || null, [catalog, typeKey]);
  const categoryTypes = useMemo(() => catalog?.types.filter((t) => t.category === category) || [], [catalog, category]);
  const categoryLabel = catalog?.categories.find((c) => c.key === category)?.label || "";

  useEffect(() => {
    fetch(`${API}/catalog`)
      .then((r) => readJson<{ categories: Category[]; types: ReportTypeDefinition[] }>(r))
      .then(setCatalog)
      .catch((e) => setCatalogError(e instanceof Error ? e.message : "Rapor kataloğu yüklenemedi."));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // A type that doesn't support the chosen record source clears it.
  function chooseType(def: ReportTypeDefinition) {
    setTypeKey(def.key);
    if (ownerType && !def.owners.includes(ownerType)) {
      setOwnerType(def.owners.length === 1 ? def.owners[0] : "");
      setBusiness("all");
    } else if (!ownerType && def.owners.length === 1) setOwnerType(def.owners[0]);
  }

  // Switching Lead ↔ Müşteri clears the other, incompatible selection
  // (and the business scope, which always belongs to one record).
  function chooseOwnerType(next: ReportOwnerType) {
    if (next === ownerType) return;
    setOwnerType(next);
    setBusiness("all");
    if (next === "lead") setCompany(null);
    else setLead(null);
  }

  function chooseOwner(type: ReportOwnerType, next: Owner | null) {
    setBusiness("all");
    if (type === "lead") setLead(next);
    else setCompany(next);
  }

  useEffect(() => {
    setBusinesses(null);
    if (!owner || !ownerType || !typeDef?.businessUnits) return;
    const controller = new AbortController();
    fetch(`${API}/businesses?ownerType=${ownerType}&ownerId=${encodeURIComponent(owner.id)}`, { signal: controller.signal })
      .then((r) => readJson<{ businesses: Business[] }>(r))
      .then((body) => setBusinesses(body.businesses))
      .catch(() => { if (!controller.signal.aborted) setBusinesses([]); });
    return () => controller.abort();
  }, [owner, ownerType, typeDef?.businessUnits]);

  const fetchPage = useCallback(async (offset: number, signal?: AbortSignal) => {
    if (!typeDef || !owner || !ownerType) return null;
    const params = reportParams(typeDef.key, ownerType, owner.id, typeDef.businessUnits ? business : "all");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (debouncedSearch.length >= 2) params.set("q", debouncedSearch);
    if (includeArchived) params.set("archived", "1");
    params.set("offset", String(offset));
    return readJson<{ items: ReportItem[]; hasMore: boolean }>(await fetch(`${API}/reports?${params}`, { signal }));
  }, [typeDef, owner, ownerType, business, from, to, debouncedSearch, includeArchived]);

  useEffect(() => {
    setItems(null);
    setHasMore(false);
    setListError("");
    if (!typeDef || !owner || !ownerType) return;
    const controller = new AbortController();
    setListLoading(true);
    fetchPage(0, controller.signal)
      .then((body) => { if (body) { setItems(body.items); setHasMore(body.hasMore); } })
      .catch((e) => { if (!controller.signal.aborted) setListError(e instanceof Error ? e.message : "Raporlar yüklenemedi."); })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [fetchPage, typeDef, owner, ownerType, reloadKey]);

  async function loadMore() {
    if (!items) return;
    setListLoading(true);
    try {
      const body = await fetchPage(items.length);
      if (body) {
        setItems([...items, ...body.items.filter((n) => !items.some((o) => o.ref === n.ref))]);
        setHasMore(body.hasMore);
      }
    } catch (e) {
      notify?.(e instanceof Error ? e.message : "Raporlar yüklenemedi.", "error");
    } finally {
      setListLoading(false);
    }
  }

  function documentUrl(item: ReportItem, variant: ReportVariant, format: "pdf" | "docx", inline = false) {
    const params = reportParams(item.type, ownerType as ReportOwnerType, owner!.id, typeDef?.businessUnits ? business : "all");
    params.set("id", item.sourceId);
    params.set("variant", variant);
    params.set("format", format);
    if (inline) params.set("disposition", "inline");
    return `${API}/document?${params}`;
  }

  async function fetchDocument(item: ReportItem, variant: ReportVariant, format: "pdf" | "docx", inline = false) {
    const response = await fetch(documentUrl(item, variant, format, inline));
    if (!response.ok) await readJson(response);
    return { blob: await response.blob(), fileName: fileNameFrom(response.headers.get("Content-Disposition"), `rapor.${format}`) };
  }

  // PDF Önizle opens in a new tab: the admin is served with
  // X-Frame-Options: DENY / frame-ancestors 'none', so no iframe is used.
  async function previewPdf(item: ReportItem, variant: ReportVariant) {
    const key = `${item.ref}:${variant}:preview`;
    const tab = window.open("", "_blank");
    if (tab) tab.document.title = "PDF hazırlanıyor…";
    setBusy(key);
    try {
      const { blob } = await fetchDocument(item, variant, "pdf", true);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (e) {
      tab?.close();
      notify?.(e instanceof Error ? e.message : "PDF önizlenemedi.", "error");
    } finally {
      setBusy("");
    }
  }

  async function download(item: ReportItem, variant: ReportVariant, format: "pdf" | "docx") {
    const key = `${item.ref}:${variant}:${format}`;
    setBusy(key);
    try {
      const { blob, fileName } = await fetchDocument(item, variant, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      notify?.(format === "pdf" ? "PDF indirildi." : "Word belgesi indirildi.", "success");
    } catch (e) {
      notify?.(e instanceof Error ? e.message : "Dosya indirilemedi.", "error");
    } finally {
      setBusy("");
    }
  }

  const closeViewer = useCallback(() => setViewing(null), []);

  if (view === "legacy") {
    return (
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: "var(--admin-text-secondary)" }}>Klasik görünüm: Reklam Doktoru değerlendirmelerini arşivleme, düzenleme ve silme işlemleri.</p>
          <AdminButton variant="secondary" compact onClick={() => setView("v2")}>Yeni Rapor Merkezi&apos;ne dön</AdminButton>
        </div>
        <LegacyReportCenterPanel content={content ?? {}} notify={notify} />
      </div>
    );
  }

  return (
    <div className="grid gap-4" data-testid="report-center-v2">
      <header className="hk-page-header flex flex-wrap items-start justify-between gap-3 border border-[var(--admin-border)]">
        <div className="min-w-0">
          <span className="hk-page-eyebrow text-xs font-black uppercase tracking-[.16em]">Tüm raporlar tek yerde</span>
          <h2 className="mt-2 text-2xl font-black" style={forceTextColor({ color: "var(--admin-text-primary)" })}>Rapor Merkezi</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>
            Önce rapor türünü, ardından lead veya müşteriyi seçin. Yalnızca seçilen kayda ait, sistemde gerçekten kayıtlı raporlar listelenir.
          </p>
        </div>
        <AdminButton variant="ghost" compact icon={<History size={14} />} onClick={() => setView("legacy")}>Klasik görünüm</AdminButton>
      </header>

      {catalogError && <AdminErrorState title="Rapor Merkezi açılamadı" description={catalogError} />}
      {!catalog && !catalogError && <AdminLoadingState label="Rapor türleri yükleniyor…" />}
      {catalog && catalog.categories.length === 0 && (
        <AdminEmptyState title="Erişebileceğiniz rapor türü yok" description="Rapor türleri, kaynak modüllerine erişim yetkinize göre gösterilir." />
      )}

      {catalog && catalog.categories.length > 0 && (
        <div className="grid gap-4 xl:grid-cols-2">
          <StepCard step={1} title="Rapor kategorisi" done={Boolean(category)} testId="step-category">
            <div className="grid gap-2 sm:grid-cols-2">
              {catalog.categories.map((c) => (
                <ChoiceButton key={c.key} active={category === c.key} description={c.description} testId={`category-${c.key}`}
                  onClick={() => { setCategory(c.key); if (typeDef?.category !== c.key) setTypeKey(""); }}>{c.label}</ChoiceButton>
              ))}
            </div>
          </StepCard>

          <StepCard step={2} title="Rapor türü" hint={category ? undefined : "Önce bir kategori seçin."} done={Boolean(typeDef)} testId="step-type">
            {category ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {categoryTypes.map((t) => (
                  <ChoiceButton key={t.key} active={typeKey === t.key} description={`${t.description} ${ownerSupportLabel(t)}`} testId={`type-${t.key}`} onClick={() => chooseType(t)}>
                    {t.label}
                  </ChoiceButton>
                ))}
              </div>
            ) : <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Kategori seçildiğinde o kategorideki rapor türleri burada listelenir.</p>}
          </StepCard>

          <StepCard step={3} title="Kayıt kaynağı" hint={typeDef ? ownerSupportLabel(typeDef) : "Önce rapor türünü seçin."} done={Boolean(ownerType)} testId="step-source">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Kayıt kaynağı">
              {(["lead", "company"] as ReportOwnerType[]).map((t) => {
                const supported = Boolean(typeDef?.owners.includes(t));
                return (
                  <ChoiceButton key={t} active={ownerType === t} disabled={!typeDef || !supported} testId={`source-${t}`} onClick={() => chooseOwnerType(t)}
                    description={typeDef && !supported ? (t === "lead" ? "Bu rapor türü lead için tutulmaz." : "Bu rapor türü müşteri için tutulmaz.") : t === "lead" ? "Henüz müşteriye dönüşmemiş adaylar." : "Aktif ve arşivli müşteri kayıtları."}>
                    <span className="inline-flex items-center gap-2">{t === "lead" ? <UserRound size={15} /> : <Users size={15} />}{OWNER_LABELS[t].source}</span>
                  </ChoiceButton>
                );
              })}
            </div>
          </StepCard>

          <StepCard step={4} title={ownerType ? OWNER_LABELS[ownerType].pick : "Lead / Müşteri seç"} hint={ownerType ? undefined : "Önce kayıt kaynağını seçin."} done={Boolean(owner)} testId="step-owner">
            {ownerType === "lead" && <OwnerPicker key="lead" ownerType="lead" value={lead} onChange={(o) => chooseOwner("lead", o)} />}
            {ownerType === "company" && <OwnerPicker key="company" ownerType="company" value={company} onChange={(o) => chooseOwner("company", o)} />}
            {!ownerType && <p className="text-sm" style={{ color: "var(--admin-text-muted)" }}>Lead ve müşteri listeleri ayrı tutulur; birbirine karışmaz.</p>}
          </StepCard>

          {typeDef?.businessUnits && owner && (
            <StepCard step={5} title="İşletme / Şube seç" hint="Yalnızca bu kayda gerçekten bağlanmış işletmeler listelenir." done testId="step-business">
              <label className="flex min-h-11 items-center gap-2 rounded-[14px] border px-3" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)" }}>
                <Building2 size={16} style={{ color: "var(--admin-text-muted)" }} />
                <span className="sr-only">İşletme / Şube</span>
                <select value={business} onChange={(e) => setBusiness(e.target.value)} className="w-full bg-transparent text-sm font-bold outline-none" style={{ color: "var(--admin-text-primary)" }} aria-label="İşletme / Şube" data-testid="business-select">
                  <option value="all">Tüm işletmeler</option>
                  <option value="main">Ana İşletme — {owner.name}</option>
                  {businesses?.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.relationship})</option>)}
                </select>
              </label>
              {businesses && businesses.length === 0 && <p className="mt-2 text-xs" style={{ color: "var(--admin-text-muted)" }}>Bu kayda bağlı şube veya ilişkili işletme yok.</p>}
            </StepCard>
          )}
        </div>
      )}

      {typeDef && owner && ownerType && (
        <div role="region" className="grid gap-3" aria-label="Raporlar" data-testid="report-list">
          <div className="admin-card flex flex-wrap items-end gap-3 rounded-[16px] p-4">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-black" style={forceTextColor({ color: "var(--admin-text-secondary)" })} htmlFor="report-search">Raporlarda ara</label>
              <input id="report-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Başlıkta ara (en az 2 karakter)"
                className="min-h-10 w-full rounded-[12px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-black" style={forceTextColor({ color: "var(--admin-text-secondary)" })} htmlFor="report-from">Başlangıç</label>
              <input id="report-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="min-h-10 rounded-[12px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-black" style={forceTextColor({ color: "var(--admin-text-secondary)" })} htmlFor="report-to">Bitiş</label>
              <input id="report-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="min-h-10 rounded-[12px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface)", color: "var(--admin-text-primary)" }} />
            </div>
            <label className="flex min-h-10 items-center gap-2 text-sm font-bold" style={{ color: "var(--admin-text-primary)" }}>
              <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} /> Arşivlenenleri göster
            </label>
            <AdminButton variant="secondary" compact icon={<RefreshCw size={14} />} loading={listLoading && items !== null} onClick={() => setReloadKey((k) => k + 1)}>Yenile</AdminButton>
          </div>

          {listError && <AdminErrorState title="Raporlar yüklenemedi" description={listError} />}
          {!listError && items === null && <AdminLoadingState label="Raporlar yükleniyor…" />}
          {!listError && items?.length === 0 && (
            <AdminEmptyState
              title="Bu seçim için kayıtlı rapor yok"
              description={`${owner.name} için ${typeDef.label} kaydı bulunamadı${from || to || debouncedSearch ? " (filtreleri temizlemeyi deneyin)" : ""}. Rapor, kaynak modülde oluşturulduğunda burada görünür.`}
            />
          )}
          {!!items?.length && (
            <>
              <p className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{items.length} rapor gösteriliyor · en yeni üstte</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {items.map((item) => {
                  const variant = variants[item.ref] || item.variants[0] || "client";
                  return (
                    <ReportCard
                      key={item.ref} item={item} typeDef={typeDef} categoryLabel={categoryLabel} ownerName={owner.name} variant={variant} busy={busy}
                      onVariant={(v) => setVariants((prev) => ({ ...prev, [item.ref]: v }))}
                      onView={() => setViewing(item)}
                      onPreview={() => previewPdf(item, variant)}
                      onDownload={(format) => download(item, variant, format)}
                    />
                  );
                })}
              </div>
              {hasMore && (
                <div className="flex justify-center">
                  <AdminButton variant="secondary" loading={listLoading} onClick={loadMore}>Daha fazla rapor yükle</AdminButton>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {viewing && typeDef && owner && ownerType && (
        <ReportDetailDrawer
          item={viewing} typeDef={typeDef} ownerType={ownerType} owner={owner} business={typeDef.businessUnits ? business : "all"}
          initialVariant={variants[viewing.ref] || viewing.variants[0] || "client"} busy={busy}
          onClose={closeViewer} onPreview={previewPdf} onDownload={download}
        />
      )}
    </div>
  );
}

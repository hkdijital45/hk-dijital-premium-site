"use client";
/* eslint-disable react-hooks/set-state-in-effect -- fetch-on-mount pattern, same accepted precedent as src/components/admin/AnalyticsReportingCenter.tsx */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, ChevronDown, Plus, Search, Trash2, X } from "lucide-react";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import {
  CONTENT_FORMAT_KEYS, CONTENT_FORMAT_LABELS, DEFAULT_THEMES,
  PLATFORM_ACCENT, PLATFORM_KEYS, PLATFORM_LABELS,
  type ContentFormatKey, type ContentPlanItem, type PlatformKey
} from "@/lib/content-plan/types";
import { findSimilarContent } from "@/lib/content-plan/similarity";
import { InstagramIntelligencePanel } from "@/components/admin/InstagramIntelligencePanel";

/**
 * İçerik Takip / Sosyal Medya Operasyon Merkezi — a multi-client content
 * tracker: HK Dijital's own account and every managed customer's social
 * content live in the same screen, scoped by a real public.companies id
 * (company_id), switched via the customer selector below. Backed by its
 * own table (social_content_plan_items) — never touches social_content_items
 * or the AI/orchestrator pipeline.
 */

type Company = { id: string; name: string; isHkDijitalSelf?: boolean };
type SocialStatusEntry = { platform: PlatformKey; connected: boolean; manual: boolean; statusLabel: string };

function readCompanyFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("company");
}

function writeCompanyToUrl(id: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("company", id);
  window.history.replaceState(null, "", url.toString());
}

type QuickFilter = "all" | "week" | "month" | "pending" | "published";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeekIso() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function startOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function formatDateLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}

/* ------------------------------- Drawer -------------------------------- */

function ContentDrawer({
  initial, companyId, allItems, allThemes, onClose, onSaved
}: {
  initial: ContentPlanItem | null;
  companyId: string;
  allItems: ContentPlanItem[];
  allThemes: string[];
  onClose: () => void;
  onSaved: (item: ContentPlanItem) => void;
}) {
  const [scheduledDate, setScheduledDate] = useState(initial?.scheduled_date || todayIso());
  const [platforms, setPlatforms] = useState<string[]>(initial?.platforms || []);
  const [theme, setTheme] = useState(initial?.theme || "");
  const [customTheme, setCustomTheme] = useState("");
  const [contentTitle, setContentTitle] = useState(initial?.content_title || "");
  const [contentFormat, setContentFormat] = useState<ContentFormatKey>((initial?.content_format as ContentFormatKey) || "static");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [isPublished, setIsPublished] = useState(initial?.is_published || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const similar = useMemo(() => findSimilarContent(contentTitle, allItems, initial?.id), [contentTitle, allItems, initial?.id]);

  function togglePlatform(key: PlatformKey) {
    setPlatforms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!scheduledDate) { setError("Tarih zorunludur."); return; }
    const finalTheme = theme === "__custom__" ? customTheme.trim() : theme;
    setSaving(true);
    try {
      const payload = { company_id: companyId, scheduled_date: scheduledDate, platforms, theme: finalTheme, content_title: contentTitle, content_format: contentFormat, notes, is_published: isPublished };
      const res = await fetch(initial ? `/api/admin/content-plan/${initial.id}` : "/api/admin/content-plan", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Kaydedilemedi.");
      onSaved(body.item);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={initial ? "İçeriği Düzenle" : "Yeni İçerik"} onMouseDown={onClose} className="fixed inset-0 z-[60] flex justify-end" style={{ background: "var(--admin-overlay, rgba(15,23,42,.55))" }}>
      <div onMouseDown={(event) => event.stopPropagation()} className="admin-drawer-panel flex h-full w-full max-w-lg min-w-0 flex-col overflow-y-auto p-5" style={{ background: "var(--admin-surface, var(--admin-bg))", boxShadow: "var(--admin-shadow-card, var(--admin-shadow))" }}>
        <div className="flex items-center justify-between gap-3">
          <strong className="text-lg font-black">{initial ? "İçeriği Düzenle" : "Yeni İçerik"}</strong>
          <button type="button" onClick={onClose} aria-label="Kapat" className="rounded-full p-2" style={{ background: "var(--admin-surface-soft)" }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-sm font-bold">
            Tarih
            <input type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="min-h-11 rounded-[10px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)" }} />
          </label>

          <div className="grid gap-1.5 text-sm font-bold">
            Platformlar
            <div className="flex flex-wrap gap-2">
              {PLATFORM_KEYS.map((key) => {
                const active = platforms.includes(key);
                return (
                  <button key={key} type="button" onClick={() => togglePlatform(key)} className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition" style={{ borderColor: active ? PLATFORM_ACCENT[key] : "var(--admin-border)", background: active ? "var(--admin-surface-soft)" : "transparent" }}>
                    <span className="size-2 rounded-full" style={{ background: PLATFORM_ACCENT[key] }} aria-hidden="true" />
                    {PLATFORM_LABELS[key]}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="grid gap-1.5 text-sm font-bold">
            Tema
            <select value={theme} onChange={(e) => setTheme(e.target.value)} className="min-h-11 rounded-[10px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
              <option value="">Tema seçin</option>
              {allThemes.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">+ Yeni tema ekle</option>
            </select>
          </label>
          {theme === "__custom__" && (
            <input value={customTheme} onChange={(e) => setCustomTheme(e.target.value)} placeholder="Yeni tema adı" className="min-h-11 rounded-[10px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)" }} />
          )}

          <label className="grid gap-1.5 text-sm font-bold">
            İçerik / Konu
            <textarea value={contentTitle} onChange={(e) => setContentTitle(e.target.value)} rows={3} placeholder="Örn. SEO ölmedi, arama şekli değişti." className="rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
          </label>

          {similar && (
            <div className="flex items-start gap-2 rounded-[10px] border p-3 text-xs font-bold" style={{ borderColor: "#fde68a", background: "#fffbeb" }}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#b45309]" />
              <span className="text-[#92400e]">Benzer bir konu {similar.daysAgo} gün önce planlanmış: &ldquo;{similar.item.content_title}&rdquo;</span>
            </div>
          )}

          <label className="grid gap-1.5 text-sm font-bold">
            Format
            <select value={contentFormat} onChange={(e) => setContentFormat(e.target.value as ContentFormatKey)} className="min-h-11 rounded-[10px] border px-3 text-sm" style={{ borderColor: "var(--admin-border)" }}>
              {CONTENT_FORMAT_KEYS.map((key) => <option key={key} value={key}>{CONTENT_FORMAT_LABELS[key]}</option>)}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-bold">
            Not <span className="font-normal opacity-60">(isteğe bağlı)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-[10px] border px-3 py-2 text-sm" style={{ borderColor: "var(--admin-border)" }} />
          </label>

          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="size-4" />
            Paylaşıldı olarak işaretle
          </label>

          {error && <p className="text-sm font-bold text-[#dc2626]">{error}</p>}

          <div className="mt-2 flex gap-2">
            <AdminButton type="submit" variant="primary" loading={saving} fullWidthOnMobile>Kaydet</AdminButton>
            <AdminButton type="button" variant="ghost" onClick={onClose}>Vazgeç</AdminButton>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------ Main center ------------------------------ */

export function ContentPlanningCenter() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [socialStatus, setSocialStatus] = useState<SocialStatusEntry[] | null>(null);

  const [items, setItems] = useState<ContentPlanItem[] | null>(null);
  const [tablesReady, setTablesReady] = useState<boolean | null>(null);
  const [tablesMessage, setTablesMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<"new" | ContentPlanItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContentPlanItem | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [platformFilter, setPlatformFilter] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"tracker" | "instagram">("tracker");

  useEffect(() => {
    const fromUrl = readCompanyFromUrl();
    if (fromUrl) setCompanyId(fromUrl);
    fetch("/api/admin/companies").then((r) => r.json()).then((body) => {
      const list: Company[] = body.companies || [];
      setCompanies(list);
      // Default to HK Dijital's own row (server-resolved, never a
      // client-side lookup) when no explicit ?company= is in the URL.
      if (!fromUrl) {
        const self = list.find((c) => c.isHkDijitalSelf);
        if (self) setCompanyId(self.id);
      }
    }).catch(() => {});
  }, []);

  function selectCompany(id: string) {
    setCompanyId(id);
    setCustomerPickerOpen(false);
    writeCompanyToUrl(id);
  }

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoadError(null);
    setItems(null);
    try {
      const res = await fetch(`/api/admin/content-plan?companyId=${companyId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Yüklenemedi.");
      setTablesReady(body.tablesReady !== false);
      setTablesMessage(body.message || null);
      setItems(body.items || []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Beklenmeyen hata.");
      setItems([]);
    }
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!companyId) return;
    setSocialStatus(null);
    fetch(`/api/admin/content-plan/social-status?companyId=${companyId}`)
      .then((r) => r.json())
      .then((body) => setSocialStatus(body.platforms || null))
      .catch(() => setSocialStatus(null));
  }, [companyId]);

  const allThemes = useMemo(() => {
    const fromItems = (items || []).map((i) => i.theme).filter(Boolean);
    return Array.from(new Set([...DEFAULT_THEMES, ...fromItems]));
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLocaleLowerCase("tr-TR");
    const weekStart = startOfWeekIso();
    const monthStart = startOfMonthIso();
    return items.filter((item) => {
      if (quickFilter === "week" && item.scheduled_date < weekStart) return false;
      if (quickFilter === "month" && item.scheduled_date < monthStart) return false;
      if (quickFilter === "pending" && item.is_published) return false;
      if (quickFilter === "published" && !item.is_published) return false;
      if (platformFilter && !item.platforms.includes(platformFilter)) return false;
      if (themeFilter && item.theme !== themeFilter) return false;
      if (formatFilter && item.content_format !== formatFilter) return false;
      if (q && !`${item.content_title} ${item.theme}`.toLocaleLowerCase("tr-TR").includes(q)) return false;
      return true;
    });
  }, [items, quickFilter, platformFilter, themeFilter, formatFilter, search]);

  const stats = useMemo(() => {
    const monthStart = startOfMonthIso();
    const thisMonth = (items || []).filter((i) => i.scheduled_date >= monthStart);
    const published = thisMonth.filter((i) => i.is_published).length;
    const platformCounts = new Map<string, number>();
    for (const item of items || []) for (const p of item.platforms) platformCounts.set(p, (platformCounts.get(p) || 0) + 1);
    return { planned: thisMonth.length, published, pending: thisMonth.length - published, platformCounts };
  }, [items]);

  async function togglePublished(item: ContentPlanItem) {
    const next = !item.is_published;
    const prevItems = items;
    setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, is_published: next, published_at: next ? new Date().toISOString() : null } : i)) ?? prev);
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/content-plan/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: next })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Güncellenemedi.");
      setItems((prev) => prev?.map((i) => (i.id === item.id ? body.item : i)) ?? prev);
    } catch (e) {
      setItems(prevItems);
      setRowError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    const prevItems = items;
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? prev);
    try {
      const res = await fetch(`/api/admin/content-plan/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Silinemedi.");
    } catch (e) {
      setItems(prevItems);
      setRowError(e instanceof Error ? e.message : "Beklenmeyen hata.");
    }
  }

  function handleSaved(item: ContentPlanItem) {
    setItems((prev) => {
      if (!prev) return [item];
      const exists = prev.some((i) => i.id === item.id);
      return exists ? prev.map((i) => (i.id === item.id ? item : i)) : [item, ...prev];
    });
  }

  return (
    <AdminWorkspace
      eyebrow="Sosyal Medya"
      title="İçerik Planlama ve Takip Merkezi"
      description="Hangi tarihte, hangi platformda, hangi tema ve konu hakkında paylaşım planladığını ve gerçekten paylaşıp paylaşmadığını takip et."
      headerActions={view === "tracker" ? <AdminButton variant="primary" icon={<Plus size={16} />} onClick={() => setDrawer("new")}>Yeni İçerik</AdminButton> : undefined}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="relative">
          <p className="mb-1 text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Müşteri</p>
          <button type="button" onClick={() => setCustomerPickerOpen((v) => !v)} className="flex min-w-56 items-center justify-between gap-3 rounded-[10px] border px-3 py-2 text-sm font-black" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface-soft)" }}>
            {companies.find((c) => c.id === companyId)?.name || "Müşteri seçin"}
            <ChevronDown size={16} />
          </button>
          {customerPickerOpen && (
            <div className="absolute z-20 mt-1 w-full min-w-56 overflow-hidden rounded-[10px] border" style={{ borderColor: "var(--admin-border)", background: "var(--admin-surface, var(--admin-bg))", boxShadow: "var(--admin-shadow-card, var(--admin-shadow))" }}>
              {companies.map((c) => (
                <button key={c.id} type="button" onClick={() => selectCompany(c.id)} className="block w-full px-3 py-2 text-left text-sm font-bold" style={{ background: c.id === companyId ? "var(--admin-surface-soft)" : "transparent" }}>
                  {c.name}
                </button>
              ))}
              {!companies.length && <p className="px-3 py-2 text-sm" style={{ color: "var(--admin-text-muted)" }}>Yükleniyor…</p>}
            </div>
          )}
        </div>

        {socialStatus && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold">
            {socialStatus.map((s) => (
              <span key={s.platform} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: s.connected ? "#15803d" : "var(--admin-text-muted)" }} aria-hidden="true" />
                {PLATFORM_LABELS[s.platform]} <span style={{ color: "var(--admin-text-muted)" }}>{s.connected ? "Bağlı" : "Manuel"}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setView("tracker")} className="rounded-full px-3.5 py-2 text-xs font-black transition" style={view === "tracker" ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft)", color: "var(--admin-text-secondary)" }}>
          İçerik Takip
        </button>
        <button type="button" onClick={() => setView("instagram")} className="rounded-full px-3.5 py-2 text-xs font-black transition" style={view === "instagram" ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft)", color: "var(--admin-text-secondary)" }}>
          Instagram Intelligence
        </button>
      </div>

      {view === "instagram" && companyId && companies.length > 0 && (
        <InstagramIntelligencePanel company={companies.find((c) => c.id === companyId) || { id: companyId, name: "" }} />
      )}

      {view === "tracker" && tablesReady === false && (
        <div className="content-plan-empty rounded-[16px] border p-8 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{tablesMessage}</p>
        </div>
      )}
      {view === "tracker" && loadError && <p className="mb-3 text-sm font-bold text-[#dc2626]">{loadError}</p>}

      {view === "tracker" && tablesReady !== false && items && (
        <div className="grid gap-5">
          {/* Compact summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Bu Ay Planlanan</p>
              <p className="mt-1 text-2xl font-black">{stats.planned}</p>
            </div>
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Yayınlanan</p>
              <p className="mt-1 text-2xl font-black text-[#15803d]">{stats.published}</p>
            </div>
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Bekleyen</p>
              <p className="mt-1 text-2xl font-black text-[#b45309]">{stats.pending}</p>
            </div>
            <div className="content-plan-stat rounded-[14px] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Platform Dağılımı</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-bold">
                {PLATFORM_KEYS.filter((k) => stats.platformCounts.get(k)).map((k) => (
                  <span key={k}>{PLATFORM_LABELS[k]} {stats.platformCounts.get(k)}</span>
                ))}
                {!stats.platformCounts.size && <span style={{ color: "var(--admin-text-muted)" }}>—</span>}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {([["all", "Tümü"], ["week", "Bu Hafta"], ["month", "Bu Ay"], ["pending", "Bekleyen"], ["published", "Yayınlanan"]] as [QuickFilter, string][]).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setQuickFilter(key)} className="rounded-full px-3.5 py-2 text-xs font-black transition" style={quickFilter === key ? { background: "#0891b2", color: "white" } : { background: "var(--admin-surface-soft)", color: "var(--admin-text-secondary)" }}>
                {label}
              </button>
            ))}
            <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-xs font-bold" style={{ borderColor: "var(--admin-border)" }}>
              <option value="">Tüm Platformlar</option>
              {PLATFORM_KEYS.map((k) => <option key={k} value={k}>{PLATFORM_LABELS[k]}</option>)}
            </select>
            <select value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-xs font-bold" style={{ borderColor: "var(--admin-border)" }}>
              <option value="">Tüm Temalar</option>
              {allThemes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)} className="min-h-9 rounded-[8px] border px-2 text-xs font-bold" style={{ borderColor: "var(--admin-border)" }}>
              <option value="">Tüm Formatlar</option>
              {CONTENT_FORMAT_KEYS.map((k) => <option key={k} value={k}>{CONTENT_FORMAT_LABELS[k]}</option>)}
            </select>
            <div className="relative ml-auto">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ara..." className="min-h-9 w-48 rounded-[8px] border py-2 pl-8 pr-3 text-xs font-bold" style={{ borderColor: "var(--admin-border)" }} />
            </div>
          </div>

          {rowError && <p className="text-sm font-bold text-[#dc2626]">{rowError}</p>}

          {!filtered.length ? (
            <div className="content-plan-empty rounded-[16px] border p-10 text-center" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>{items.length ? "Bu filtrelerle eşleşen içerik yok." : "Henüz içerik planı oluşturmadın."}</p>
              {!items.length && <div className="mt-4"><AdminButton variant="primary" icon={<Plus size={16} />} onClick={() => setDrawer("new")}>İlk İçeriğini Ekle</AdminButton></div>}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto rounded-[16px] border lg:block" style={{ borderColor: "var(--admin-border)" }}>
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>
                      <th className="p-3">Durum</th>
                      <th className="p-3">Tarih</th>
                      <th className="p-3">Platformlar</th>
                      <th className="p-3">Tema</th>
                      <th className="p-3">İçerik / Konu</th>
                      <th className="p-3">Format</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id} className={item.is_published ? "plan-row-published" : "plan-row-pending"}>
                        <td className="p-3">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input type="checkbox" checked={item.is_published} onChange={() => togglePublished(item)} className="size-4" />
                            <AdminStatusBadge tone={item.is_published ? "success" : "warning"}>{item.is_published ? "Paylaşıldı" : "Bekliyor"}</AdminStatusBadge>
                          </label>
                        </td>
                        <td className="whitespace-nowrap p-3 font-bold">{formatDateLabel(item.scheduled_date)}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {item.platforms.map((p) => (
                              <span key={p} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ borderColor: "var(--admin-border)" }}>
                                <span className="size-1.5 rounded-full" style={{ background: PLATFORM_ACCENT[p as PlatformKey] || "#64748b" }} aria-hidden="true" />
                                {PLATFORM_LABELS[p as PlatformKey] || p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>{item.theme || "—"}</td>
                        <td className="max-w-sm p-3 font-bold cursor-pointer" onClick={() => setDrawer(item)}>{item.content_title || "—"}</td>
                        <td className="p-3 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>{CONTENT_FORMAT_LABELS[item.content_format as ContentFormatKey] || item.content_format}</td>
                        <td className="p-3">
                          <button type="button" onClick={() => setPendingDelete(item)} aria-label="Sil" className="rounded-full p-2" style={{ color: "var(--admin-text-muted)" }}><Trash2 size={15} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="grid gap-3 lg:hidden">
                {filtered.map((item) => (
                  <div key={item.id} className={`rounded-[14px] border p-4 ${item.is_published ? "plan-row-published" : "plan-row-pending"}`} style={{ borderColor: "var(--admin-border)" }}>
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={item.is_published} onChange={() => togglePublished(item)} className="size-4" />
                        <AdminStatusBadge tone={item.is_published ? "success" : "warning"}>{item.is_published ? "Paylaşıldı" : "Bekliyor"}</AdminStatusBadge>
                      </label>
                      <span className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{formatDateLabel(item.scheduled_date)}</span>
                    </div>
                    <p className="mt-2 font-bold" onClick={() => setDrawer(item)}>{item.content_title || "—"}</p>
                    <p className="mt-1 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>{item.theme || "—"} · {CONTENT_FORMAT_LABELS[item.content_format as ContentFormatKey] || item.content_format}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.platforms.map((p) => (
                        <span key={p} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ borderColor: "var(--admin-border)" }}>
                          <span className="size-1.5 rounded-full" style={{ background: PLATFORM_ACCENT[p as PlatformKey] || "#64748b" }} aria-hidden="true" />
                          {PLATFORM_LABELS[p as PlatformKey] || p}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button type="button" onClick={() => setPendingDelete(item)} aria-label="Sil" className="rounded-full p-2" style={{ color: "var(--admin-text-muted)" }}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {drawer && (
        <ContentDrawer
          initial={drawer === "new" ? null : drawer}
          companyId={companyId}
          allItems={items || []}
          allThemes={allThemes}
          onClose={() => setDrawer(null)}
          onSaved={handleSaved}
        />
      )}

      {pendingDelete && (
        <div role="alertdialog" aria-modal="true" aria-label="Silme Onayı" className="fixed inset-0 z-[70] grid place-items-center p-4" style={{ background: "var(--admin-overlay, rgba(15,23,42,.55))" }} onMouseDown={() => setPendingDelete(null)}>
          <div onMouseDown={(event) => event.stopPropagation()} className="admin-modal-panel w-full max-w-sm rounded-[16px] p-5" style={{ background: "var(--admin-surface, var(--admin-bg))" }}>
            <p className="font-black">İçeriği sil?</p>
            <p className="mt-2 text-sm" style={{ color: "var(--admin-text-secondary)" }}>&ldquo;{pendingDelete.content_title || "Bu içerik"}&rdquo; kalıcı olarak silinecek. Bu işlem geri alınamaz.</p>
            <div className="mt-4 flex gap-2">
              <AdminButton variant="danger" onClick={confirmDelete}>Sil</AdminButton>
              <AdminButton variant="ghost" onClick={() => setPendingDelete(null)}>Vazgeç</AdminButton>
            </div>
          </div>
        </div>
      )}
    </AdminWorkspace>
  );
}

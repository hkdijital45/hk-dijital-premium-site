"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Archive, Ban, CalendarClock, CheckCircle2, CircleDot, Eye, Inbox, Mail, Phone, RefreshCw, Search, Trash2, UserPlus, User, X } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminConfirmDialog } from "@/components/admin/ui/AdminConfirmDialog";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import {
  CONTACT_REQUEST_STATUS,
  formatApplicationParts,
  isConverted,
  statusKeyFor,
  type ContactBulkAction,
  type ContactRequestRow,
  type ContactRequestStatusKey,
  type DuplicateMatch,
  type LeadConversionValues
} from "@/lib/contact-requests";

type FilterKey = "all" | ContactRequestStatusKey;
type ReadFilter = "all" | "unread";
type SortKey = "new" | "old";
type Conversion = { request: ContactRequestRow; values: LeadConversionValues; duplicates: DuplicateMatch[]; saving: boolean; error: string };
type BulkResult = {
  updated: number;
  skipped: number;
  rows?: Array<Pick<ContactRequestRow, "id" | "status" | "read_at" | "converted_lead_id" | "converted_at">>;
  deletedIds?: string[];
};

const TONE: Record<ContactRequestStatusKey, "warning" | "info" | "success" | "neutral" | "danger"> = {
  new: "warning", reviewing: "info", converted: "success", archived: "neutral", spam: "danger"
};
const FILTERS: FilterKey[] = ["all", "new", "reviewing", "converted", "archived", "spam"];

// Buttons placed on the dark bulk bar: white action buttons and a light ghost.
const LIGHT_ON_DARK = { background: "#ffffff", borderColor: "#ffffff", color: "#0f172a" } as const;
const GHOST_ON_DARK = { background: "transparent", borderColor: "#94a3b8", color: "#ffffff" } as const;

function statusKeyOf(row: ContactRequestRow): ContactRequestStatusKey {
  return isConverted(row) ? "converted" : statusKeyFor(row.status);
}

function previewOf(message: string | null) {
  const text = String(message ?? "").replace(/\s+/g, " ").trim();
  return text.length > 240 ? `${text.slice(0, 240)}…` : text || "Mesaj yok";
}

function StatusBadge({ status }: { status: string | null }) {
  const key = statusKeyFor(status);
  return <AdminStatusBadge tone={TONE[key]}>{CONTACT_REQUEST_STATUS[key]}</AdminStatusBadge>;
}

function UnreadBadge() {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-cyan-700 px-2.5 py-1 text-xs font-black text-white">
      <CircleDot size={12} aria-hidden />Okunmadı
    </span>
  );
}

function DrawerSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h4 id={id} className="text-sm font-black text-[#0f172a]">{title}</h4>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[12px] border p-3.5" style={{ borderColor: "var(--admin-border)" }}>
      <dt className="text-sm font-bold text-[#64748b]">{label}</dt>
      <dd className="mt-1 break-words text-base font-bold text-[#0f172a]">{children}</dd>
    </div>
  );
}

export function ContactRequestsInbox({
  notify,
  onRowsChange
}: {
  notify?: (message: string, type?: string) => void;
  onRowsChange?: (rows: ContactRequestRow[]) => void;
}) {
  const [requests, setRequests] = useState<ContactRequestRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [conversion, setConversion] = useState<Conversion | null>(null);

  const all = useMemo(() => requests ?? [], [requests]);

  function commit(next: ContactRequestRow[]) {
    setRequests(next);
    onRowsChange?.(next);
  }

  async function load() {
    setLoadError("");
    try {
      const response = await fetch("/api/admin/contact-requests", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Talepler yüklenemedi.");
      const rows: ContactRequestRow[] = data.requests || [];
      const ids = new Set(rows.map((row) => row.id));
      setSelectedIds((current) => current.filter((id) => ids.has(id)));
      commit(rows);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Talepler yüklenemedi.");
    }
  }

  // Mount-only initial load; load is recreated each render and must not re-run.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  // Deep link from a notification: /hk-admin/gelen-talepler?request=<id>
  const [deepLinkChecked, setDeepLinkChecked] = useState(false);
  useEffect(() => {
    if (!requests || deepLinkChecked) return;
    setDeepLinkChecked(true);
    const id = new URLSearchParams(window.location.search).get("request");
    const row = id ? requests.find((item) => item.id === id) : undefined;
    if (row) openDrawer(row);
    // openDrawer is stable for this one-time check
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests, deepLinkChecked]);

  useEffect(() => {
    if (!drawerId) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerId]);

  // A material scope change clears selection so an invisible record can never be acted on.
  useEffect(() => { setSelectedIds([]); }, [filter, readFilter, search, sort]);

  const counts = useMemo(() => {
    const byKey = { all: all.length, new: 0, reviewing: 0, converted: 0, archived: 0, spam: 0 } as Record<FilterKey, number>;
    for (const row of all) byKey[statusKeyOf(row)] += 1;
    return byKey;
  }, [all]);
  const unreadCount = useMemo(() => all.filter((row) => !row.read_at).length, [all]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    const digits = search.replace(/\D/g, "");
    const rows = all.filter((row) => {
      if (filter !== "all" && statusKeyOf(row) !== filter) return false;
      if (readFilter === "unread" && row.read_at) return false;
      if (!term) return true;
      return [row.name, row.company, row.email].some((v) => String(v ?? "").toLocaleLowerCase("tr").includes(term))
        || (digits.length >= 4 && String(row.phone ?? "").replace(/\D/g, "").includes(digits));
    });
    const direction = sort === "new" ? -1 : 1;
    return [...rows].sort((a, b) => direction * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  }, [all, filter, readFilter, search, sort]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleSelectedCount = visible.filter((row) => selectedSet.has(row.id)).length;
  const allVisibleSelected = visible.length > 0 && visibleSelectedCount === visible.length;
  const drawerRow = all.find((row) => row.id === drawerId) || null;

  function toggleOne(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleIds = new Set(visible.map((row) => row.id));
      setSelectedIds((current) => current.filter((id) => !visibleIds.has(id)));
    } else {
      setSelectedIds((current) => [...new Set([...current, ...visible.map((row) => row.id)])]);
    }
  }

  async function post(action: ContactBulkAction, ids: string[] = []): Promise<BulkResult | null> {
    try {
      const response = await fetch("/api/admin/contact-requests/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids.length ? { action, ids } : { action })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      return data as BulkResult;
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "İşlem tamamlanamadı.", "error");
      return null;
    }
  }

  // Applies a server result to local rows (and the dashboard's copy for the
  // notification center and nav badge) without refetching the whole list.
  function applyResult(result: BulkResult) {
    if (result.deletedIds) {
      const removed = new Set(result.deletedIds);
      commit(all.filter((row) => !removed.has(row.id)));
      setSelectedIds((current) => current.filter((id) => !removed.has(id)));
      return;
    }
    if (result.rows) {
      const changed = new Map(result.rows.map((row) => [row.id, row]));
      commit(all.map((row) => (changed.has(row.id) ? { ...row, ...changed.get(row.id) } : row)));
    }
  }

  async function runAction(action: ContactBulkAction, ids: string[], success: string) {
    setBusy(true);
    const result = await post(action, ids);
    setBusy(false);
    if (!result) return;
    applyResult(result);
    const skippedNote = result.skipped > 0 ? ` ${result.skipped} talep değişmedi.` : "";
    notify?.(`${success}${result.updated ? "" : " Değişiklik gerekmedi."}${skippedNote}`.trim(), "success");
  }

  async function confirmBulkDelete(ids: string[]) {
    setBusy(true);
    const result = await post("delete", ids);
    setBusy(false);
    setConfirmDelete(null);
    if (!result) return;
    applyResult(result);
    notify?.(`${result.updated} iletişim talebi silindi. Bağlı Lead kayıtları etkilenmedi.`, "success");
  }

  // Opening a request marks it read only. Workflow status is never touched, and a
  // failed read update does not block viewing the request.
  function openDrawer(row: ContactRequestRow) {
    setDrawerId(row.id);
    if (!row.read_at) {
      post("mark_read", [row.id]).then((result) => { if (result) applyResult(result); });
    }
  }

  async function openConversion(row: ContactRequestRow) {
    try {
      const response = await fetch(`/api/admin/contact-requests/${row.id}/convert`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Dönüştürme ekranı açılamadı.");
      if (data.alreadyConverted) { notify?.("Bu talep zaten Lead'e dönüştürüldü.", "error"); await load(); return; }
      setConversion({ request: row, values: data.values, duplicates: data.duplicates || [], saving: false, error: "" });
    } catch (error) {
      notify?.(error instanceof Error ? error.message : "Dönüştürme ekranı açılamadı.", "error");
    }
  }

  async function submitConversion(allowDuplicate: boolean) {
    if (!conversion) return;
    setConversion({ ...conversion, saving: true, error: "" });
    try {
      const response = await fetch(`/api/admin/contact-requests/${conversion.request.id}/convert`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: conversion.values, allowDuplicate })
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409 && Array.isArray(data.duplicates)) {
        setConversion({ ...conversion, duplicates: data.duplicates, saving: false, error: "" });
        return;
      }
      if (!response.ok) throw new Error(data.error || "Lead oluşturulamadı.");
      setConversion(null);
      setDrawerId(null);
      notify?.("Talep Lead'e dönüştürüldü.", "success");
      await load();
    } catch (error) {
      setConversion((current) => current && { ...current, saving: false, error: error instanceof Error ? error.message : "Lead oluşturulamadı." });
    }
  }

  const selectedCount = selectedIds.length;
  const drawerTitle = drawerRow ? (drawerRow.company || drawerRow.name || "İsimsiz talep") : "";

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase tracking-[.14em] text-[var(--admin-text-muted)]">İletişim Merkezi</p>
          <h2 className="mt-1 text-3xl font-black text-[var(--admin-text-primary)]">Gelen Talepler</h2>
          <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--admin-text-secondary)]">Web sitenizden gelen başvuruları inceleyin, yönetin ve uygun olanları satış sürecine aktarın.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton variant="secondary" compact icon={<RefreshCw size={15} />} onClick={load} disabled={busy}>Yenile</AdminButton>
          <AdminButton variant="primary" compact icon={<CheckCircle2 size={15} />} disabled={busy || unreadCount === 0 || requests === null} onClick={() => runAction("mark_all_read", [], "Tüm okunmamış talepler okundu olarak işaretlendi.")}>
            Tümünü Okundu Yap{unreadCount > 0 ? ` (${unreadCount})` : ""}
          </AdminButton>
        </div>
      </header>

      <section aria-label="Özet" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Okunmamış", value: unreadCount, emphasis: true },
          { label: "Yeni", value: counts.new },
          { label: "İnceleniyor", value: counts.reviewing },
          { label: "Lead'e dönüşen", value: counts.converted },
          { label: "Arşivlenen", value: counts.archived }
        ].map((card) => (
          <div key={card.label} className="grid gap-1 rounded-[14px] border bg-[#ffffff] p-4" style={{ borderColor: card.emphasis && unreadCount ? "#67e8f9" : "var(--admin-border)", background: card.emphasis && unreadCount ? "#ecfeff" : "#fff" }}>
            <p className="text-sm font-bold text-[#334155]">{card.label}</p>
            <p className="text-3xl font-black leading-none text-[#0f172a] tabular-nums">{requests === null ? "—" : card.value}</p>
          </div>
        ))}
      </section>

      <section aria-label="Arama ve filtreler" className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" aria-hidden />
            <label className="sr-only" htmlFor="contact-search">Ad, firma, e-posta veya telefon ara</label>
            <input id="contact-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, firma, e-posta veya telefon ara…" className="min-h-11 w-full rounded-[10px] border bg-[#ffffff] pl-9 pr-3 text-base font-semibold text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border)" }} />
          </div>
          <div role="group" aria-label="Okunma durumu" className="flex gap-1 rounded-[10px] border bg-[#ffffff] p-1" style={{ borderColor: "#cbd5e1" }}>
            {([["all", "Tümü"], ["unread", "Okunmamış"]] as const).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={readFilter === key} onClick={() => setReadFilter(key)} className="min-h-10 rounded-[8px] px-3.5 text-sm font-black hover:bg-[#f1f5f9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" style={readFilter === key ? { background: "#0e7490", color: "#ffffff" } : { background: "#ffffff", color: "#0f172a" }}>{label}</button>
            ))}
          </div>
          <label className="sr-only" htmlFor="contact-sort">Sıralama</label>
          <select id="contact-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="min-h-11 rounded-[10px] border bg-[#ffffff] px-3 text-base font-bold text-[#334155]" style={{ borderColor: "var(--admin-border)" }}>
            <option value="new">En yeni</option>
            <option value="old">En eski</option>
          </select>
        </div>
        <div role="tablist" aria-label="Talep durumu" className="premium-scrollbar flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((key) => {
            const active = filter === key;
            const label = key === "all" ? "Tümü" : CONTACT_REQUEST_STATUS[key as ContactRequestStatusKey];
            return (
              <button key={key} role="tab" type="button" aria-selected={active} onClick={() => setFilter(key)} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600" style={active ? { background: "#0e7490", borderColor: "#0e7490", color: "#ffffff" } : { background: "#ffffff", borderColor: "#cbd5e1", color: "#0f172a" }}>
                <span style={{ color: "inherit" }}>{label}</span><span className="tabular-nums text-xs font-black" style={{ color: "inherit" }}>{counts[key]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-4" style={{ borderColor: "#fecdd3", background: "#fff1f2" }}>
          <p className="text-sm font-bold text-[#9f1239]">{loadError}</p>
          <AdminButton variant="secondary" compact onClick={load}>Tekrar dene</AdminButton>
        </div>
      )}

      {requests === null && !loadError && (
        <div className="grid gap-3" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="h-36 rounded-[14px] border bg-[#f8fafc] motion-safe:animate-pulse" style={{ borderColor: "var(--admin-border)" }} />)}
        </div>
      )}

      {requests !== null && visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed bg-[#ffffff] px-6 py-12 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <span className="grid size-12 place-items-center rounded-full bg-[#f1f5f9] text-[#475569]" aria-hidden><Inbox size={22} /></span>
          <p className="text-lg font-black text-[#0f172a]">{all.length ? "Bu filtrede talep yok." : "Henüz gelen iletişim talebi yok."}</p>
          <p className="max-w-md text-sm font-semibold text-[#64748b]">{all.length ? "Arama, okunma veya durum filtresini değiştirmeyi deneyin." : "Web sitenizdeki iletişim formu gönderildiğinde talepler burada görünür."}</p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-[var(--admin-text-primary)]">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(node) => { if (node) node.indeterminate = visibleSelectedCount > 0 && !allVisibleSelected; }}
                onChange={toggleAllVisible}
                aria-label={`Görünen ${visible.length} talebin tümünü seç`}
                className="size-5 cursor-pointer accent-cyan-700"
              />
              Görünen {visible.length} talebin tümünü seç
            </label>
            <p className="text-sm font-semibold text-[var(--admin-text-secondary)]">{visible.length} talep listeleniyor</p>
          </div>

          {selectedCount > 0 && (
            <div role="region" aria-label="Toplu işlemler" className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-[14px] border bg-[#0f172a] p-3 shadow-xl" style={{ borderColor: "#0f172a", color: "#ffffff" }}>
              <p className="mr-auto px-1 text-base font-black tabular-nums" aria-live="polite" style={{ color: "#ffffff" }}>{selectedCount} talep seçildi</p>
              <AdminButton variant="secondary" compact style={LIGHT_ON_DARK} disabled={busy} onClick={() => runAction("mark_read", selectedIds, `${selectedCount} talep okundu olarak işaretlendi.`)}>Okundu Yap</AdminButton>
              <AdminButton variant="secondary" compact style={LIGHT_ON_DARK} disabled={busy} onClick={() => runAction("mark_unread", selectedIds, `${selectedCount} talep okunmadı olarak işaretlendi.`)}>Okunmadı Yap</AdminButton>
              <AdminButton variant="secondary" compact style={LIGHT_ON_DARK} disabled={busy} onClick={() => runAction("review", selectedIds, "Seçili talepler incelemeye alındı.")}>İncelemeye Al</AdminButton>
              <AdminButton variant="secondary" compact style={LIGHT_ON_DARK} icon={<Archive size={14} />} disabled={busy} onClick={() => runAction("archive", selectedIds, "Seçili talepler arşivlendi.")}>Arşivle</AdminButton>
              <AdminButton variant="warning" compact icon={<Ban size={14} />} disabled={busy} onClick={() => runAction("spam", selectedIds, "Seçili talepler spam olarak işaretlendi.")}>Spam</AdminButton>
              <AdminButton variant="danger" compact icon={<Trash2 size={14} />} disabled={busy} onClick={() => setConfirmDelete(selectedIds)}>Sil</AdminButton>
              <AdminButton variant="ghost" compact style={GHOST_ON_DARK} disabled={busy} onClick={() => setSelectedIds([])}>Seçimi Temizle</AdminButton>
            </div>
          )}

          <ul className="grid gap-3" aria-label="İletişim talepleri">
            {visible.map((row) => {
              const converted = isConverted(row);
              const unread = !row.read_at;
              const checked = selectedSet.has(row.id);
              const title = row.company || row.name || "İsimsiz talep";
              const applied = formatApplicationParts(row.created_at);
              return (
                <li
                  key={row.id}
                  className="relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-4 rounded-[14px] border p-4 pl-3 sm:p-5 sm:pl-4 md:grid-cols-[auto_minmax(0,1fr)_auto]"
                  style={{
                    borderColor: checked ? "#0e7490" : unread ? "#a5f3fc" : "var(--admin-border)",
                    background: unread ? "#f0fdff" : "#ffffff",
                    boxShadow: checked ? "0 0 0 2px rgba(14,116,144,.25)" : undefined
                  }}
                >
                  {unread && <span aria-hidden className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-cyan-700" />}
                  <label className="grid size-11 cursor-pointer place-items-center">
                    <input type="checkbox" checked={checked} onChange={() => toggleOne(row.id)} aria-label={`${title} talebini seç`} className="size-5 cursor-pointer accent-cyan-700" />
                  </label>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`min-w-0 truncate text-lg text-[#0f172a] ${unread ? "font-black" : "font-extrabold"}`} title={title}>{title}</p>
                      {unread && <UnreadBadge />}
                      <StatusBadge status={converted ? CONTACT_REQUEST_STATUS.converted : row.status} />
                    </div>
                    {row.company && row.name && (
                      <p className="mt-1.5 flex min-w-0 items-center gap-2 text-base font-semibold text-[#334155]"><User size={15} className="shrink-0 text-[#64748b]" aria-hidden /><span className="min-w-0 truncate">{row.name}</span></p>
                    )}
                    <div className="mt-2 grid gap-1.5 text-base text-[#334155] sm:grid-cols-2 sm:gap-x-5">
                      <p className="flex min-w-0 items-start gap-2"><Mail size={15} className="mt-1 shrink-0 text-[#64748b]" aria-hidden /><span className="min-w-0 break-all font-semibold">{row.email || "E-posta yok"}</span></p>
                      <p className="flex min-w-0 items-center gap-2"><Phone size={15} className="shrink-0 text-[#64748b]" aria-hidden /><span className="font-semibold tabular-nums">{row.phone || "Telefon yok"}</span></p>
                    </div>
                    <p className="mt-3 line-clamp-2 break-words rounded-[10px] bg-[#f8fafc] px-3.5 py-3 text-base leading-7 text-[#1e293b]">{previewOf(row.message)}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-bold text-[#334155]">
                      <span className="inline-flex items-center gap-1.5"><CalendarClock size={15} className="text-[#64748b]" aria-hidden />{applied.date} • {applied.time}</span>
                      <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-xs font-black text-[#334155]">{row.source || "Web sitesi"}</span>
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-end md:col-span-1 md:col-start-auto">
                    <AdminButton variant="primary" compact icon={<Eye size={15} />} onClick={() => openDrawer(row)}>Talebi Aç</AdminButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {drawerRow && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-[#0f172a]/40" onMouseDown={() => setDrawerId(null)}>
          <aside role="dialog" aria-modal="true" aria-labelledby="contact-drawer-title" className="flex h-full w-full max-w-[min(600px,100vw)] flex-col overflow-hidden bg-[#ffffff] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: "var(--admin-border)" }}>
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-[.14em] text-cyan-700">Gelen talep</p>
                <h3 id="contact-drawer-title" className="mt-1 break-words text-2xl font-black leading-tight text-[#0f172a]">{drawerTitle}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!drawerRow.read_at && <UnreadBadge />}
                  <StatusBadge status={isConverted(drawerRow) ? CONTACT_REQUEST_STATUS.converted : drawerRow.status} />
                </div>
              </div>
              <button type="button" onClick={() => setDrawerId(null)} aria-label="Kapat" autoFocus className="grid size-11 shrink-0 place-items-center rounded-[10px] border focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border)" }}><X size={18} aria-hidden /></button>
            </header>

            <div className="grid flex-1 content-start gap-6 overflow-y-auto p-5">
              <DrawerSection id="drawer-contact" title="Başvuru Bilgileri">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Field label="Firma">{drawerRow.company || "—"}</Field>
                  <Field label="Ad Soyad">{drawerRow.name || "—"}</Field>
                  <Field label="E-posta">{drawerRow.email ? <a className="break-all text-cyan-800 underline underline-offset-2" href={`mailto:${drawerRow.email}`}>{drawerRow.email}</a> : "—"}</Field>
                  <Field label="Telefon">{drawerRow.phone ? <a className="tabular-nums text-cyan-800 underline underline-offset-2" href={`tel:${drawerRow.phone}`}>{drawerRow.phone}</a> : "—"}</Field>
                </dl>
              </DrawerSection>

              <DrawerSection id="drawer-message" title="Mesaj">
                <p className="whitespace-pre-wrap break-words rounded-[12px] border bg-[#f8fafc] p-4 text-base leading-7 text-[#0f172a]" style={{ borderColor: "var(--admin-border)" }}>{drawerRow.message || "Mesaj yok"}</p>
              </DrawerSection>

              <DrawerSection id="drawer-details" title="Başvuru Detayları">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Field label="Başvuru Tarihi">{formatApplicationParts(drawerRow.created_at).date}</Field>
                  <Field label="Başvuru Saati">{formatApplicationParts(drawerRow.created_at).time || "—"}</Field>
                  <Field label="Kaynak">{drawerRow.source || "Web sitesi"}</Field>
                  <Field label="Durum"><StatusBadge status={isConverted(drawerRow) ? CONTACT_REQUEST_STATUS.converted : drawerRow.status} /></Field>
                  <Field label="Okunma Durumu">
                    <span className="grid gap-2">
                      <span>{drawerRow.read_at ? "Okundu" : "Okunmadı"}</span>
                      <button type="button" disabled={busy} onClick={() => runAction(drawerRow.read_at ? "mark_unread" : "mark_read", [drawerRow.id], drawerRow.read_at ? "Talep okunmadı olarak işaretlendi." : "Talep okundu olarak işaretlendi.")} className="w-fit text-sm font-bold text-cyan-800 underline underline-offset-2 disabled:opacity-50">
                        {drawerRow.read_at ? "Okunmadı olarak işaretle" : "Okundu olarak işaretle"}
                      </button>
                    </span>
                  </Field>
                </dl>
              </DrawerSection>

              {isConverted(drawerRow) && (
                <DrawerSection id="drawer-lead" title="Lead Bilgisi">
                  <div className="grid gap-3 rounded-[12px] border p-4" style={{ borderColor: "#bbf7d0", background: "#f0fdf4" }}>
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <Field label="Lead'e Dönüştürülme Tarihi">{drawerRow.converted_at ? formatApplicationParts(drawerRow.converted_at).date : "—"}</Field>
                      <Field label="Lead'e Dönüştürülme Saati">{drawerRow.converted_at ? formatApplicationParts(drawerRow.converted_at).time : "—"}</Field>
                    </dl>
                    <Link href="/hk-admin/leads" className="hk-button hk-button-secondary hk-button-compact inline-flex w-fit items-center">Lead&apos;i Görüntüle</Link>
                  </div>
                </DrawerSection>
              )}
            </div>

            <footer className="grid gap-3 border-t p-5" style={{ borderColor: "var(--admin-border)" }}>
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="primary" icon={<UserPlus size={15} />} disabled={busy || isConverted(drawerRow)} onClick={() => openConversion(drawerRow)}>Lead&apos;e Kaydet</AdminButton>
                {statusKeyFor(drawerRow.status) !== "reviewing" && !isConverted(drawerRow) && (
                  <AdminButton variant="secondary" disabled={busy} onClick={() => runAction("review", [drawerRow.id], "Talep incelemeye alındı.")}>İncelemeye al</AdminButton>
                )}
              </div>
              {!isConverted(drawerRow) && (
                <div className="flex flex-wrap gap-2 text-sm">
                  <button type="button" disabled={busy} onClick={() => runAction("archive", [drawerRow.id], "Talep arşivlendi.")} className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 font-bold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-50"><Archive size={15} aria-hidden />Arşivle</button>
                  <button type="button" disabled={busy} onClick={() => runAction("spam", [drawerRow.id], "Talep spam olarak işaretlendi.")} className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 font-bold text-[#9f1239] hover:bg-[#fff1f2] disabled:opacity-50"><Ban size={15} aria-hidden />Spam olarak işaretle</button>
                  <button type="button" disabled={busy} onClick={() => setConfirmDelete([drawerRow.id])} className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 font-bold text-[#9f1239] hover:bg-[#fff1f2] disabled:opacity-50"><Trash2 size={15} aria-hidden />Sil</button>
                </div>
              )}
            </footer>
          </aside>
        </div>
      )}

      <AdminConfirmDialog
        open={Boolean(confirmDelete)}
        title={`${confirmDelete?.length ?? 0} iletişim talebini sil`}
        description={`${confirmDelete?.length ?? 0} iletişim talebini kalıcı olarak silmek üzeresiniz. Bu işlem geri alınamaz. Bu taleplerden oluşturulmuş Lead kayıtları silinmez.`}
        confirmLabel={`${confirmDelete?.length ?? 0} Talebi Sil`}
        cancelLabel="Vazgeç"
        tone="danger"
        busy={busy}
        onConfirm={() => confirmDelete && confirmBulkDelete(confirmDelete)}
        onCancel={() => { if (!busy) setConfirmDelete(null); }}
      />

      {conversion && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#0f172a]/50 p-4" onMouseDown={() => !conversion.saving && setConversion(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="conversion-title" className="grid max-h-[90vh] w-full max-w-lg gap-4 overflow-y-auto rounded-[16px] bg-[#ffffff] p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div>
              <p className="text-sm font-black uppercase tracking-[.14em] text-cyan-700">Lead&apos;e kaydet</p>
              <h3 id="conversion-title" className="mt-1 text-xl font-black text-[#0f172a]">Bilgileri kontrol edin</h3>
              <p className="mt-1 text-sm font-semibold text-[#475569]">Bu bilgilerle mevcut Lead sisteminde yeni bir Lead oluşturulur.</p>
            </div>
            {conversion.duplicates.length > 0 && (
              <div role="alert" className="grid gap-2 rounded-[12px] border p-4" style={{ borderColor: "#fde68a", background: "#fffbeb" }}>
                <p className="text-sm font-black text-[#92400e]">Bu iletişim bilgileriyle eşleşen mevcut bir Lead bulundu.</p>
                {conversion.duplicates.map((match) => (
                  <p key={match.leadId} className="text-sm font-semibold text-[#78350f]">{match.company || match.name || "Lead"} · {match.status || "Durum yok"} · eşleşme: {match.reasons.join(", ")}</p>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Link href="/hk-admin/leads" className="hk-button hk-button-secondary hk-button-compact inline-flex items-center">Mevcut Lead&apos;i Aç</Link>
                  <AdminButton variant="warning" compact disabled={conversion.saving} onClick={() => submitConversion(true)}>Yine de Yeni Lead Oluştur</AdminButton>
                </div>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["company", "Firma"], ["name", "Yetkili / İlgili kişi"], ["phone", "Telefon"], ["email", "E-posta"]
              ] as const).map(([field, label]) => (
                <label key={field} className="grid gap-1.5 text-sm font-bold text-[#334155]">
                  {label}
                  <input value={conversion.values[field]} onChange={(e) => setConversion({ ...conversion, values: { ...conversion.values, [field]: e.target.value } })} className="min-h-11 rounded-[10px] border px-3 text-base font-semibold text-[#0f172a]" style={{ borderColor: "var(--admin-border)" }} />
                </label>
              ))}
              <label className="grid gap-1.5 text-sm font-bold text-[#334155] sm:col-span-2">
                Not
                <textarea rows={4} value={conversion.values.message} onChange={(e) => setConversion({ ...conversion, values: { ...conversion.values, message: e.target.value } })} className="rounded-[10px] border p-3 text-base font-semibold text-[#0f172a]" style={{ borderColor: "var(--admin-border)" }} />
              </label>
            </div>
            <p className="text-sm font-semibold text-[#64748b]">Kaynak: İletişim Formu</p>
            {conversion.error && <p role="alert" className="text-sm font-bold text-[#be123c]">{conversion.error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <AdminButton variant="secondary" disabled={conversion.saving} onClick={() => setConversion(null)}>Vazgeç</AdminButton>
              <AdminButton variant="primary" loading={conversion.saving} disabled={conversion.saving || conversion.duplicates.length > 0} onClick={() => submitConversion(false)}>Lead Oluştur</AdminButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

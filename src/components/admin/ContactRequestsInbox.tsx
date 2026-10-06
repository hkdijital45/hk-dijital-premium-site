"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Ban, CheckCircle2, Eye, Inbox, RefreshCw, Search, UserPlus, X } from "lucide-react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { CONTACT_REQUEST_STATUS, isConverted, statusKeyFor, type ContactRequestRow, type ContactRequestStatusKey, type DuplicateMatch, type LeadConversionValues } from "@/lib/contact-requests";
import { formatReportTimestamp } from "@/lib/report-timestamp";

type FilterKey = "all" | ContactRequestStatusKey;
type SortKey = "new" | "old";
type Conversion = { request: ContactRequestRow; values: LeadConversionValues; duplicates: DuplicateMatch[]; saving: boolean; error: string; leadId: string | null };

const TONE: Record<ContactRequestStatusKey, "warning" | "info" | "success" | "neutral" | "danger"> = {
  new: "warning", reviewing: "info", converted: "success", archived: "neutral", spam: "danger"
};
const FILTERS: FilterKey[] = ["all", "new", "reviewing", "converted", "archived", "spam"];

function previewOf(message: string | null) {
  const text = String(message ?? "").replace(/\s+/g, " ").trim();
  return text.length > 160 ? `${text.slice(0, 160)}…` : text || "Mesaj yok";
}

function StatusBadge({ status }: { status: string | null }) {
  const key = statusKeyFor(status);
  return <AdminStatusBadge tone={TONE[key]}>{CONTACT_REQUEST_STATUS[key]}</AdminStatusBadge>;
}

export function ContactRequestsInbox() {
  const [requests, setRequests] = useState<ContactRequestRow[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [conversion, setConversion] = useState<Conversion | null>(null);

  async function load() {
    setLoadError("");
    try {
      const response = await fetch("/api/admin/contact-requests", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Talepler yüklenemedi.");
      setRequests(data.requests || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Talepler yüklenemedi.");
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId]);

  const all = useMemo(() => requests ?? [], [requests]);
  const counts = useMemo(() => {
    const byKey = { all: all.length, new: 0, reviewing: 0, converted: 0, archived: 0, spam: 0 } as Record<FilterKey, number>;
    for (const row of all) {
      const key = isConverted(row) ? "converted" : statusKeyFor(row.status);
      byKey[key] += 1;
    }
    return byKey;
  }, [all]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr");
    const digits = search.replace(/\D/g, "");
    const rows = all.filter((row) => {
      const key = isConverted(row) ? "converted" : statusKeyFor(row.status);
      if (filter !== "all" && key !== filter) return false;
      if (!term) return true;
      return [row.name, row.company, row.email].some((v) => String(v ?? "").toLocaleLowerCase("tr").includes(term))
        || (digits.length >= 4 && String(row.phone ?? "").replace(/\D/g, "").includes(digits));
    });
    const direction = sort === "new" ? -1 : 1;
    return [...rows].sort((a, b) => direction * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  }, [all, filter, search, sort]);

  const selected = all.find((row) => row.id === selectedId) || null;

  async function setStatus(row: ContactRequestRow, key: "reviewing" | "archived" | "spam") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/contact-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, status: key }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Durum güncellenemedi.");
      setMessage(`Talep "${CONTACT_REQUEST_STATUS[key]}" olarak işaretlendi.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Durum güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function openConversion(row: ContactRequestRow) {
    setMessage("");
    try {
      const response = await fetch(`/api/admin/contact-requests/${row.id}/convert`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Dönüştürme ekranı açılamadı.");
      if (data.alreadyConverted) { setMessage("Bu talep zaten Lead'e dönüştürüldü."); await load(); return; }
      setConversion({ request: row, values: data.values, duplicates: data.duplicates || [], saving: false, error: "", leadId: null });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dönüştürme ekranı açılamadı.");
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
      setMessage("Talep Lead'e dönüştürüldü.");
      await load();
    } catch (error) {
      setConversion((current) => current && { ...current, saving: false, error: error instanceof Error ? error.message : "Lead oluşturulamadı." });
    }
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">İletişim Merkezi</p>
          <h2 className="mt-1 text-2xl font-black text-[#0f172a]">Gelen Talepler</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#475569]">Web sitenizdeki iletişim formundan gelen başvuruları inceleyin ve uygun olanları satış sürecine aktarın.</p>
        </div>
        <AdminButton variant="secondary" compact icon={<RefreshCw size={14} />} onClick={load}>Yenile</AdminButton>
      </header>

      <section aria-label="Özet" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Yeni talepler", value: counts.new, icon: <Inbox size={16} />, tone: "warning" as const },
          { label: "İncelenen", value: counts.reviewing, icon: <Eye size={16} />, tone: "info" as const },
          { label: "Lead'e dönüşen", value: counts.converted, icon: <CheckCircle2 size={16} />, tone: "success" as const },
          { label: "Arşivlenen", value: counts.archived, icon: <Archive size={16} />, tone: "neutral" as const }
        ].map((card) => (
          <div key={card.label} className="flex items-center gap-3 rounded-[14px] border bg-white p-4" style={{ borderColor: "var(--admin-border)" }}>
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-[#f1f5f9] text-[#334155]" aria-hidden>{card.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#475569]">{card.label}</p>
              <p className="text-2xl font-black text-[#0f172a] tabular-nums">{requests === null ? "—" : card.value}</p>
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Arama ve filtreler" className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" aria-hidden />
            <label className="sr-only" htmlFor="contact-search">Ad, firma, e-posta veya telefon ara</label>
            <input id="contact-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ad, firma, e-posta veya telefon ara…" className="min-h-11 w-full rounded-[10px] border bg-white pl-9 pr-3 text-sm font-semibold text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border)" }} />
          </div>
          <label className="sr-only" htmlFor="contact-sort">Sıralama</label>
          <select id="contact-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="min-h-11 rounded-[10px] border bg-white px-3 text-sm font-bold text-[#334155]" style={{ borderColor: "var(--admin-border)" }}>
            <option value="new">En yeni</option>
            <option value="old">En eski</option>
          </select>
        </div>
        <div role="tablist" aria-label="Talep durumu" className="premium-scrollbar flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((key) => {
            const active = filter === key;
            const label = key === "all" ? "Tümü" : CONTACT_REQUEST_STATUS[key as ContactRequestStatusKey];
            return (
              <button key={key} role="tab" type="button" aria-selected={active} onClick={() => setFilter(key)} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600" style={active ? { background: "#0f172a", color: "#fff" } : { background: "#f1f5f9", color: "#334155" }}>
                {label}<span className="tabular-nums text-xs opacity-80">{counts[key]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {message && <p role="status" className="rounded-[12px] border bg-[#f8fafc] px-4 py-3 text-sm font-bold text-[#334155]" style={{ borderColor: "var(--admin-border)" }}>{message}</p>}

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-4" style={{ borderColor: "#fecdd3", background: "#fff1f2" }}>
          <p className="text-sm font-bold text-[#9f1239]">{loadError}</p>
          <AdminButton variant="secondary" compact onClick={load}>Tekrar dene</AdminButton>
        </div>
      )}

      {requests === null && !loadError && (
        <div className="grid gap-3" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-[14px] border bg-[#f8fafc] motion-safe:animate-pulse" style={{ borderColor: "var(--admin-border)" }} />)}
        </div>
      )}

      {requests !== null && visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed bg-white px-6 py-12 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <span className="grid size-12 place-items-center rounded-full bg-[#f1f5f9] text-[#475569]" aria-hidden><Inbox size={22} /></span>
          <p className="text-base font-black text-[#0f172a]">{all.length ? "Bu filtrede talep yok." : "Henüz gelen iletişim talebi yok."}</p>
          <p className="max-w-md text-sm font-semibold text-[#64748b]">{all.length ? "Arama veya durum filtresini değiştirmeyi deneyin." : "Web sitenizdeki iletişim formu gönderildiğinde talepler burada görünür."}</p>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="grid gap-3" aria-label="İletişim talepleri">
          {visible.map((row) => {
            const converted = isConverted(row);
            return (
              <li key={row.id} className="grid gap-3 rounded-[14px] border bg-white p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center motion-safe:transition-shadow motion-safe:hover:shadow-[0_6px_18px_rgba(15,23,42,.08)]" style={{ borderColor: "var(--admin-border)" }}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-black text-[#0f172a]" title={row.company || row.name || ""}>{row.company || row.name || "İsimsiz talep"}</p>
                    <StatusBadge status={converted ? CONTACT_REQUEST_STATUS.converted : row.status} />
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-[#334155]">{row.name || "Ad belirtilmedi"}{row.email ? ` · ${row.email}` : ""}{row.phone ? ` · ${row.phone}` : ""}</p>
                  <p className="mt-1.5 line-clamp-2 break-words text-sm leading-6 text-[#475569]">{previewOf(row.message)}</p>
                  <p className="mt-2 text-xs font-bold text-[#64748b]">{formatReportTimestamp(row.created_at)} · {row.source || "Web sitesi"}</p>
                </div>
                <div className="flex justify-end">
                  <AdminButton variant="primary" compact icon={<Eye size={14} />} onClick={() => setSelectedId(row.id)}>Talebi Aç</AdminButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-[#0f172a]/40" onMouseDown={() => setSelectedId(null)}>
          <aside role="dialog" aria-modal="true" aria-labelledby="contact-drawer-title" className="flex h-full w-full max-w-[min(560px,100vw)] flex-col overflow-hidden bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <header className="flex items-start justify-between gap-4 border-b p-5" style={{ borderColor: "var(--admin-border)" }}>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Gelen talep</p>
                <h3 id="contact-drawer-title" className="mt-1 truncate text-xl font-black text-[#0f172a]">{selected.company || selected.name || "İsimsiz talep"}</h3>
                <div className="mt-2"><StatusBadge status={isConverted(selected) ? CONTACT_REQUEST_STATUS.converted : selected.status} /></div>
              </div>
              <button type="button" onClick={() => setSelectedId(null)} aria-label="Kapat" autoFocus className="grid size-11 shrink-0 place-items-center rounded-[10px] border focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600" style={{ borderColor: "var(--admin-border)" }}><X size={18} aria-hidden /></button>
            </header>
            <div className="grid flex-1 content-start gap-5 overflow-y-auto p-5">
              <dl className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Ad Soyad", selected.name || "—"], ["Firma", selected.company || "—"], ["Telefon", selected.phone || "—"], ["E-posta", selected.email || "—"],
                  ["Kaynak", selected.source || "Web sitesi"], ["Geliş", formatReportTimestamp(selected.created_at)]
                ].map(([label, value]) => (
                  <div key={label} className="min-w-0 rounded-[12px] border p-3" style={{ borderColor: "var(--admin-border)" }}>
                    <dt className="text-xs font-bold text-[#64748b]">{label}</dt>
                    <dd className="mt-1 break-words text-sm font-bold text-[#0f172a]">{value}</dd>
                  </div>
                ))}
              </dl>
              <section aria-labelledby="contact-message-title" className="grid gap-2">
                <h4 id="contact-message-title" className="text-xs font-black uppercase tracking-[.08em] text-[#475569]">Mesaj</h4>
                <p className="whitespace-pre-wrap break-words rounded-[12px] border bg-[#f8fafc] p-4 text-sm leading-6 text-[#0f172a]" style={{ borderColor: "var(--admin-border)" }}>{selected.message || "Mesaj yok"}</p>
              </section>
              {isConverted(selected) && (
                <div className="grid gap-2 rounded-[12px] border p-4" style={{ borderColor: "#bbf7d0", background: "#f0fdf4" }}>
                  <p className="text-sm font-black text-[#166534]">Lead&apos;e dönüştürüldü{selected.converted_at ? ` · ${formatReportTimestamp(selected.converted_at)}` : ""}</p>
                  <Link href="/hk-admin/leads" className="hk-button hk-button-secondary hk-button-compact inline-flex w-fit items-center">Lead&apos;i Görüntüle</Link>
                </div>
              )}
            </div>
            <footer className="grid gap-3 border-t p-5" style={{ borderColor: "var(--admin-border)" }}>
              <div className="flex flex-wrap gap-2">
                <AdminButton variant="primary" icon={<UserPlus size={15} />} disabled={busy || isConverted(selected)} onClick={() => openConversion(selected)}>Lead&apos;e Kaydet</AdminButton>
                {statusKeyFor(selected.status) !== "reviewing" && !isConverted(selected) && (
                  <AdminButton variant="secondary" disabled={busy} onClick={() => setStatus(selected, "reviewing")}>İncelemeye al</AdminButton>
                )}
              </div>
              {!isConverted(selected) && (
                <div className="flex flex-wrap gap-2 text-sm">
                  <button type="button" disabled={busy} onClick={() => setStatus(selected, "archived")} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 font-bold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-50"><Archive size={15} aria-hidden />Arşivle</button>
                  <button type="button" disabled={busy} onClick={() => setStatus(selected, "spam")} className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-3 font-bold text-[#9f1239] hover:bg-[#fff1f2] disabled:opacity-50"><Ban size={15} aria-hidden />Spam olarak işaretle</button>
                </div>
              )}
            </footer>
          </aside>
        </div>
      )}

      {conversion && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#0f172a]/50 p-4" onMouseDown={() => !conversion.saving && setConversion(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="conversion-title" className="grid max-h-[90vh] w-full max-w-lg gap-4 overflow-y-auto rounded-[16px] bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div>
              <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-700">Lead&apos;e kaydet</p>
              <h3 id="conversion-title" className="mt-1 text-lg font-black text-[#0f172a]">Bilgileri kontrol edin</h3>
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
                  <input value={conversion.values[field]} onChange={(e) => setConversion({ ...conversion, values: { ...conversion.values, [field]: e.target.value } })} className="min-h-11 rounded-[10px] border px-3 text-sm font-semibold text-[#0f172a]" style={{ borderColor: "var(--admin-border)" }} />
                </label>
              ))}
              <label className="grid gap-1.5 text-sm font-bold text-[#334155] sm:col-span-2">
                Not
                <textarea rows={4} value={conversion.values.message} onChange={(e) => setConversion({ ...conversion, values: { ...conversion.values, message: e.target.value } })} className="rounded-[10px] border p-3 text-sm font-semibold text-[#0f172a]" style={{ borderColor: "var(--admin-border)" }} />
              </label>
            </div>
            <p className="text-xs font-semibold text-[#64748b]">Kaynak: İletişim Formu</p>
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

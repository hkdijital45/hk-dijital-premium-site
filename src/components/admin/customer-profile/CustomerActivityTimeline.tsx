"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { AdminStatusBadge } from "@/components/admin/ui/AdminStatusBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminWorkspace } from "@/components/admin/workspace/AdminWorkspace";
import { AdminControlPanel, AdminFilterSection } from "@/components/admin/workspace/AdminControlPanel";
import { AdminDetailInspector } from "@/components/admin/workspace/AdminDetailInspector";
import { AdminActionBar } from "@/components/admin/workspace/AdminActionBar";

// Entities that already have their own tab inside this same Customer 360
// drawer — used to build a real "İlgili kayda git" link instead of a fake one.
const entityTabMap: Record<string, string> = {
  "Görev": "Yapılacaklar",
  "Tahsilat": "Ödemeler",
  "Firma": "Genel Bilgi",
  "Marka Varlıkları": "Marka Varlıkları",
  "Müşteri Entegrasyonları": "Entegrasyonlar",
  "Rapor": "Raporlar"
};

function resultTone(item: any): "success" | "warning" | "danger" | "neutral" {
  const result = item.details?.result || item.result;
  if (result === "Başarılı") return "success";
  if (result === "Uyarı") return "warning";
  if (item.details?.error || result === "Hata") return "danger";
  return "neutral";
}

function statusTone(item: any): "success" | "warning" | "neutral" {
  if (item.archived_at) return "neutral";
  if (item.status === "Görüldü" || item.is_seen) return "success";
  return "warning";
}

function dayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tarih bilinmiyor";
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function CustomerActivityTimeline({ items, onOpenTab }: { items: any[]; onOpenTab?: (tab: string) => void }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("Tümü");
  const [responsibleFilter, setResponsibleFilter] = useState("Tümü");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const entityTypes = useMemo(() => Array.from(new Set((items || []).map((item: any) => item.entity).filter(Boolean))).sort(), [items]);
  const responsibleNames = useMemo(() => Array.from(new Set((items || []).map((item: any) => item.actor_name).filter(Boolean))).sort(), [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr");
    return (items || [])
      .filter((item: any) => (typeFilter === "Tümü" ? true : item.entity === typeFilter))
      .filter((item: any) => (responsibleFilter === "Tümü" ? true : item.actor_name === responsibleFilter))
      .filter((item: any) => {
        const date = String(item.created_at || "").slice(0, 10);
        if (startDate && date < startDate) return false;
        if (endDate && date > endDate) return false;
        return true;
      })
      .filter((item: any) => {
        if (!query) return true;
        const haystack = `${item.entity || ""} ${item.action || ""} ${item.details?.message || ""} ${item.actor_name || ""}`.toLocaleLowerCase("tr");
        return haystack.includes(query);
      })
      .sort((a: any, b: any) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }, [items, search, typeFilter, responsibleFilter, startDate, endDate]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: any[] }[] = [];
    for (const item of filtered) {
      const label = dayLabel(item.created_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [filtered]);

  const selected = selectedId ? (items || []).find((item: any) => item.id === selectedId) || null : null;
  const relatedTab = selected ? entityTabMap[selected.entity] : undefined;

  return (
    <AdminWorkspace
      eyebrow="Müşteri Profili"
      title="Aktivite Geçmişi"
      description="Bu müşteriye ait görev, tahsilat, profil, rapor ve entegrasyon hareketlerinin kronolojik kaydı. Arama/mesaj/WhatsApp geçmişi ayrı İletişim Geçmişi sekmesindedir."
      leftPanel={
        <AdminControlPanel>
          <AdminFilterSection title="Ara ve Filtrele">
            <div className="grid gap-2">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Aktivitede ara..."
                className="min-h-9 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-500"
              />
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                Aktivite türü
                <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900">
                  <option value="Tümü">Tüm türler</option>
                  {entityTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              {responsibleNames.length > 0 && (
                <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                  Sorumlu kullanıcı
                  <select value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900">
                    <option value="Tümü">Tüm kullanıcılar</option>
                    {responsibleNames.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
              )}
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Başlangıç tarihi<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900" /></label>
              <label className="grid gap-1.5 text-xs font-bold text-slate-700">Bitiş tarihi<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900" /></label>
              <button type="button" onClick={() => { setSearch(""); setTypeFilter("Tümü"); setResponsibleFilter("Tümü"); setStartDate(""); setEndDate(""); }} className="rounded-[8px] border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">Filtreleri Temizle</button>
            </div>
          </AdminFilterSection>
        </AdminControlPanel>
      }
      rightPanel={
        <AdminDetailInspector
          title={selected ? `${selected.entity || "Aktivite"} · ${selected.action || ""}` : undefined}
          subtitle={selected ? `${selected.actor_name || "Bilinmeyen"} · ${formatDateTime(selected.created_at)}` : undefined}
          emptyTitle="Bir aktivite seçin"
          emptyDescription="Listeden bir kayda tıklayarak detaylarını buradan görüntüleyin."
          fields={selected ? [
            { label: "Modül", value: selected.module || selected.entity || "-" },
            { label: "Rol", value: selected.role || "-" },
            { label: "Durum", value: selected.status || (selected.is_seen ? "Görüldü" : "Görülmedi") },
            { label: "Sonuç", value: selected.details?.result || selected.result || "-" }
          ] : undefined}
          actions={selected && relatedTab && onOpenTab ? (
            <button type="button" onClick={() => onOpenTab(relatedTab)} className="hk-button hk-button-info hk-button-compact">{relatedTab} Sekmesini Aç</button>
          ) : undefined}
        >
          {selected?.details?.message && <p className="rounded-[8px] border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">{selected.details.message}</p>}
          {selected?.details?.error && <p className="mt-2 rounded-[8px] border border-red-200 bg-red-50 p-2 text-xs font-bold text-red-700">{selected.details.error}</p>}
        </AdminDetailInspector>
      }
      bottomBar={<AdminActionBar statusText={`${filtered.length} aktivite kaydı`}>{null}</AdminActionBar>}
    >
      {!items?.length && <AdminEmptyState title="Bu müşteri için henüz aktivite kaydı yok." description="Görev, tahsilat, profil, rapor veya entegrasyon değişikliği yapıldığında burada listelenir." />}
      {Boolean(items?.length) && !filtered.length && <AdminEmptyState title="Filtrelere uygun aktivite bulunamadı." />}
      {grouped.map((group) => (
        <div key={group.label} className="mb-3">
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-[.1em]" style={{ color: "var(--admin-text-muted)" }}>{group.label}</p>
          <div className="grid gap-1.5">
            {group.items.map((item: any) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`rounded-[8px] border p-2.5 text-left ${selectedId === item.id ? "border-cyan-300 bg-cyan-50" : "border-slate-200 bg-white"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-bold text-slate-800">{item.entity || "Aktivite"} · {item.action || "-"}</span>
                  <span className="flex shrink-0 gap-1.5">
                    <AdminStatusBadge tone={resultTone(item)}>{item.details?.result || item.result || "Bilgi"}</AdminStatusBadge>
                    <AdminStatusBadge tone={statusTone(item)}>{item.archived_at ? "Arşivlendi" : (item.status || (item.is_seen ? "Görüldü" : "Görülmedi"))}</AdminStatusBadge>
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px]" style={{ color: "var(--admin-text-muted)" }}>
                  <span>{item.actor_name || "Bilinmeyen"}{item.role ? ` · ${item.role}` : ""}</span>
                  <span>{formatDateTime(item.created_at)}</span>
                </div>
                {item.details?.message && <p className="mt-1 truncate text-xs text-slate-600">{item.details.message}</p>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </AdminWorkspace>
  );
}

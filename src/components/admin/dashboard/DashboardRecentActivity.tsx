"use client";

import type { DashboardActivityItem, NavigateFn } from "./types";

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

export function DashboardRecentActivity({
  items,
  filter,
  onFilterChange,
  onNavigate,
  limit = 7
}: {
  items: DashboardActivityItem[];
  filter: string;
  onFilterChange: (filter: string) => void;
  onNavigate: NavigateFn;
  limit?: number;
}) {
  return (
    <div className="admin-card rounded-[20px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>Canlı Aktivite Akışı</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>Son operasyon hareketleri, filtrelenmiş görünüm.</p>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          {["Bugün", "Bu hafta", "Tümü"].map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => onFilterChange(option)}
              className={`rounded-full px-3 py-1.5 text-xs font-black ${filter === option ? "bg-[var(--admin-surface)] text-[var(--hk-cyan-text)] shadow-sm" : "text-[var(--admin-text-muted)]"}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {items.slice(0, limit).map((item, index) => (
          <div key={item.id || index} className="admin-card-soft grid gap-3 rounded-[14px] p-3 sm:grid-cols-[120px_1fr_auto] sm:items-center">
            <span className="rounded-full bg-[var(--admin-surface)] px-3 py-1 text-center text-[10px] font-black text-[var(--admin-text-muted)] ring-1 ring-[var(--admin-border)]">{item.user || "Hayri"}</span>
            <span>
              <strong className="block text-sm" style={{ color: "var(--admin-text-primary)" }}>{item.action || "Operasyon hareketi"}</strong>
              <span className="mt-1 block text-xs" style={{ color: "var(--admin-text-muted)" }}>{item.entity || item.module || "HK Operating System"}</span>
            </span>
            <span className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{formatDateTime(item.created_at)}</span>
          </div>
        ))}
        {!items.length && (
          <button type="button" onClick={() => onNavigate("Sistem Logları")} className="rounded-[14px] border border-dashed border-[var(--admin-border)] p-4 text-left text-sm text-[var(--admin-text-muted)]">
            Henüz aktivite kaydı yok. Tüm sistem loglarını görmek için tıklayın.
          </button>
        )}
      </div>
    </div>
  );
}

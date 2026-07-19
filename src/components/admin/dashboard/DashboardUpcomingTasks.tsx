"use client";

import type { DashboardUpcomingTask, NavigateFn } from "./types";

export function DashboardUpcomingTasks({ items, onNavigate }: { items: DashboardUpcomingTask[]; onNavigate: NavigateFn }) {
  return (
    <div className="admin-card rounded-[20px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>Yaklaşan Görevler</h3>
          <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>Kritik ve geciken görevlerden öne çıkanlar.</p>
        </div>
        <button type="button" onClick={() => onNavigate("Görevler")} className="hk-button hk-button-compact hk-button-info">Görevleri Aç</button>
      </div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <div key={item.id || item.title} className="admin-card-soft flex items-center justify-between gap-3 rounded-[14px] p-3">
            <span className="min-w-0">
              <strong className="block truncate text-sm" style={{ color: "var(--admin-text-primary)" }}>{item.title || "Görev"}</strong>
              <span className="mt-1 block text-xs" style={{ color: "var(--admin-text-muted)" }}>{item.priority || "Orta"} · {item.due_date || "Tarih yok"}</span>
            </span>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">{item.status || "Yapılacak"}</span>
          </div>
        ))}
        {!items.length && <p className="rounded-[14px] border border-dashed border-slate-200 p-4 text-sm text-slate-500">Yaklaşan kritik görev yok.</p>}
      </div>
    </div>
  );
}

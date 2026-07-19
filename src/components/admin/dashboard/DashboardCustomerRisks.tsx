"use client";

import type { DashboardRiskyCustomer, NavigateFn } from "./types";

export function DashboardCustomerRisks({ items, onNavigate }: { items: DashboardRiskyCustomer[]; onNavigate: NavigateFn }) {
  return (
    <div className="admin-card rounded-[20px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>Müşteri Riskleri</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>Sağlık skoru düşük müşteriler.</p>
        </div>
        <button type="button" onClick={() => onNavigate("Müşteriler")} className="hk-button hk-button-compact hk-button-info">Tümünü Gör</button>
      </div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <button
            type="button"
            key={item.company.id}
            onClick={() => onNavigate("Müşteriler")}
            className="flex min-h-11 items-center justify-between gap-3 rounded-[12px] border border-red-100 bg-red-50 px-3 text-left"
          >
            <span className="min-w-0 truncate text-sm font-bold text-slate-800">{item.company.name || "İsimsiz müşteri"}</span>
            <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-black text-red-700">{item.health.score}/100</span>
          </button>
        ))}
        {!items.length && <p className="rounded-[12px] border border-dashed border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Kritik müşteri riski görünmüyor.</p>}
      </div>
    </div>
  );
}

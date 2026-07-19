"use client";

import { AdminKpiCard } from "@/components/admin/ui/AdminKpiCard";
import type { DashboardKpiItem, NavigateFn } from "./types";

export function DashboardKpiGrid({ items, onNavigate }: { items: DashboardKpiItem[]; onNavigate: NavigateFn }) {
  return (
    <section aria-labelledby="daily-summary-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="daily-summary-title" className="text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>Günlük Özet</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>Karar vermeniz gereken en önemli altı gösterge.</p>
        </div>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {items.map((item) => (
          <AdminKpiCard key={item.label} label={item.label} value={item.value} note={item.note} icon={item.icon} tone={item.tone} onClick={() => onNavigate(item.target)} />
        ))}
      </div>
    </section>
  );
}

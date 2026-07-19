"use client";

import type { NavigateFn } from "./types";

export function DashboardAdPerformance({
  riskyCustomerCount,
  latestCustomerName,
  averageScore,
  onNavigate
}: {
  riskyCustomerCount: number;
  latestCustomerName: string;
  averageScore: number | string;
  onNavigate: NavigateFn;
}) {
  return (
    <section className="admin-card rounded-[22px] p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-purple-700">HK Reklam Zekası</p>
          <h3 className="mt-2 text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>Reklam Doktoru Pro</h3>
          <p className="mt-1 text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>Meta, Google ve sosyal reklam verilerinden sağlık skoru, aksiyon planı ve müşteri özeti üretin.</p>
        </div>
        <button type="button" onClick={() => onNavigate("Reklam Doktoru Pro")} className="hk-button hk-button-ai">Hızlı Giriş</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="admin-card-soft rounded-[14px] p-4">
          <span className="text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Kritik müşteri</span>
          <strong className="mt-2 block text-2xl" style={{ color: "var(--admin-text-primary)" }}>{riskyCustomerCount}</strong>
        </div>
        <div className="admin-card-soft rounded-[14px] p-4">
          <span className="text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Son yorumlanan</span>
          <strong className="mt-2 block truncate text-base" style={{ color: "var(--admin-text-primary)" }}>{latestCustomerName || "Henüz yok"}</strong>
        </div>
        <div className="admin-card-soft rounded-[14px] p-4">
          <span className="text-xs font-black uppercase" style={{ color: "var(--admin-text-muted)" }}>Ortalama skor</span>
          <strong className="mt-2 block text-2xl" style={{ color: "var(--admin-text-primary)" }}>{averageScore}</strong>
        </div>
      </div>
    </section>
  );
}

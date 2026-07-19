"use client";

import type { DashboardOverviewCard, NavigateFn } from "./types";

export function DashboardFinanceSummary({
  overviewCards,
  packageDistribution,
  onNavigate
}: {
  overviewCards: DashboardOverviewCard[];
  packageDistribution: { starter: number; pro: number; premium: number; none: number };
  onNavigate: NavigateFn;
}) {
  const packageRows: [string, number][] = [
    ["Starter müşteri", packageDistribution.starter],
    ["Pro müşteri", packageDistribution.pro],
    ["Premium müşteri", packageDistribution.premium],
    ["Paketsiz müşteri", packageDistribution.none]
  ];
  return (
    <section className="grid min-w-0 gap-5">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {overviewCards.map((item) => (
          <div key={item.label} className="admin-card rounded-[20px] p-4 transition hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[.12em]" style={{ color: "var(--admin-text-muted)" }}>{item.label}</p>
                <p className="mt-2 truncate text-2xl font-black" style={{ color: "var(--admin-text-primary)" }}>{item.value}</p>
                <p className="mt-1 text-xs font-semibold leading-5" style={{ color: "var(--admin-text-muted)" }}>{item.note}</p>
              </div>
              <span className={`grid size-10 shrink-0 place-items-center rounded-[14px] ${item.tone}`}>{item.icon}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="admin-card rounded-[22px] p-5" style={{ borderColor: "color-mix(in srgb, #f59e0b 35%, var(--admin-border))" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em]" style={{ color: "#b45309" }}>Paket Dağılımı</p>
            <h3 className="mt-2 text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>Aktif müşteri paket özeti</h3>
            <p className="mt-1 text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>Paketsiz müşteriler teklif veya onboarding kontrolü bekler.</p>
          </div>
          <button type="button" onClick={() => onNavigate("Müşteriler")} className="hk-button hk-button-compact hk-button-warning">Müşterilere Git</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {packageRows.map(([label, value]) => (
            <div key={label} className="admin-card-soft rounded-[16px] p-4">
              <p className="text-[11px] font-black uppercase tracking-[.12em]" style={{ color: "#b45309" }}>{label}</p>
              <p className="mt-2 text-3xl font-black" style={{ color: "var(--admin-text-primary)" }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

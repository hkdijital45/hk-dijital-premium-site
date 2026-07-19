"use client";

import type { DashboardPipelineStage, NavigateFn } from "./types";

export function DashboardSalesPipeline({ stages, onNavigate }: { stages: DashboardPipelineStage[]; onNavigate: NavigateFn }) {
  return (
    <div className="admin-card rounded-[22px] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>Pipeline Özeti</h3>
        <button type="button" onClick={() => onNavigate("Satış Hunisi")} className="hk-button hk-button-compact hk-button-info">Satış Hunisini Aç</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {stages.map((stage) => (
          <div key={stage.stage} className="admin-card-soft rounded-[16px] p-3">
            <div className={`mb-3 h-1.5 rounded-full bg-gradient-to-r ${stage.gradient}`} />
            <p className="text-xs font-black" style={{ color: "var(--admin-text-muted)" }}>{stage.stage}</p>
            <p className="mt-1 text-2xl font-black" style={{ color: "var(--admin-text-primary)" }}>{stage.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

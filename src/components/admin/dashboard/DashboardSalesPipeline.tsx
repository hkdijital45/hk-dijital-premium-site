"use client";

import type { DashboardPipelineStage, NavigateFn } from "./types";

export function DashboardSalesPipeline({ stages, onNavigate }: { stages: DashboardPipelineStage[]; onNavigate: NavigateFn }) {
  return (
    <div className="admin-card rounded-[22px] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>Pipeline Özeti</h3>
        <button type="button" onClick={() => onNavigate("Satış Hunisi")} className="hk-button hk-button-compact hk-button-info">Satış Hunisini Aç</button>
      </div>
      <div className="mc-pipeline-grid">
        {stages.map((stage) => (
          <div key={stage.stage} className="mc-pipeline-item">
            <div className="mc-pipeline-bar" />
            <span>{stage.stage}</span>
            <strong>{stage.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

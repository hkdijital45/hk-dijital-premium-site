"use client";

import type { DashboardAiHealthDimension, DashboardAutomationSuggestion, NavigateFn } from "./types";

const STATUS_TONE: Record<DashboardAiHealthDimension["status"], string> = {
  Sağlıklı: "bg-green-100 text-green-700",
  Riskli: "bg-amber-100 text-amber-700",
  Kritik: "bg-red-100 text-red-700"
};

export function DashboardAiRecommendations({
  dimensions,
  suggestions,
  onNavigate
}: {
  dimensions: DashboardAiHealthDimension[];
  suggestions: DashboardAutomationSuggestion[];
  onNavigate: NavigateFn;
}) {
  return (
    <section className="grid min-w-0 gap-5 xl:grid-cols-2">
      <div className="admin-card rounded-[22px] p-5">
        <h3 className="text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>AI Health Score</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>Reklam, içerik, lead, satış ve tahsilat sağlığı.</p>
        <div className="mt-4 grid gap-3">
          {dimensions.map((item) => (
            <details key={item.label} className="admin-card-soft rounded-[14px] p-3">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    <strong className="block text-sm" style={{ color: "var(--admin-text-primary)" }}>{item.label}</strong>
                    <span className="mt-1 block text-xs" style={{ color: "var(--admin-text-muted)" }}>Neden bu puanı aldı?</span>
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${STATUS_TONE[item.status]}`}>{item.score}/100 · {item.status}</span>
                </div>
              </summary>
              <p className="mt-3 rounded-[12px] bg-white p-3 text-xs leading-5 text-slate-600">{item.reason}</p>
            </details>
          ))}
        </div>
      </div>
      <div className="admin-card rounded-[22px] border border-emerald-100 bg-emerald-50 p-5">
        <h3 className="font-black text-slate-950">Bekleyen otomasyon aksiyonları</h3>
        <p className="mt-1 text-sm leading-6 text-emerald-900">Mevcut görev/rapor/tahsilat/entegrasyon sinyallerinden üretilen öneriler.</p>
        <div className="mt-4 grid gap-2">
          {suggestions.map((item) => (
            <button key={item.title} type="button" onClick={() => onNavigate(item.target)} className={`rounded-[14px] border border-white bg-white p-3 text-left shadow-sm ${item.tone}`}>
              <strong className="block text-sm">{item.title}</strong>
              <span className="mt-1 block text-xs font-semibold leading-5">{item.detail}</span>
            </button>
          ))}
          {!suggestions.length && <p className="rounded-[14px] border border-dashed border-emerald-200 bg-white p-4 text-sm text-emerald-900">Bekleyen otomasyon aksiyonu görünmüyor.</p>}
        </div>
      </div>
    </section>
  );
}

"use client";

import { Sparkles } from "lucide-react";
import type { DashboardPriorityAction, NavigateFn } from "./types";

const SEVERITY_TONE: Record<DashboardPriorityAction["severity"], string> = {
  Kritik: "bg-red-100 text-red-700",
  Uyarı: "bg-amber-100 text-amber-800",
  Fırsat: "bg-emerald-100 text-emerald-700"
};

export function DashboardPriorityActions({
  items,
  commandPlan,
  onGeneratePlan,
  onNavigate
}: {
  items: DashboardPriorityAction[];
  commandPlan: string;
  onGeneratePlan: () => void;
  onNavigate: NavigateFn;
}) {
  return (
    <section className="admin-card rounded-[20px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>Bugün ne yapmalıyım?</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>Görev, tahsilat, bağlantı ve lead sinyalleri önem sırasına göre birleştirildi.</p>
        </div>
        <button type="button" onClick={onGeneratePlan} className="hk-button hk-button-ai"><Sparkles size={18} /> Günlük Plan Oluştur</button>
      </div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <article key={item.id} className="admin-card-soft grid min-w-0 gap-3 rounded-[14px] p-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto_auto] sm:items-center">
            <strong className="truncate text-sm" style={{ color: "var(--admin-text-primary)" }}>{item.customer}</strong>
            <span className="break-words text-sm" style={{ color: "var(--admin-text-secondary)" }}>{item.reason}</span>
            <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${SEVERITY_TONE[item.severity]}`}>{item.severity}</span>
            <button type="button" onClick={() => onNavigate(item.target)} className="hk-button hk-button-compact hk-button-info">{item.action}</button>
          </article>
        ))}
        {!items.length && (
          <p className="rounded-[14px] border border-dashed border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">Şu anda acil aksiyon gerektiren bir durum bulunmuyor.</p>
        )}
      </div>
      {commandPlan && <pre className="admin-card-soft mt-4 whitespace-pre-wrap rounded-[14px] p-4 text-sm leading-7" style={{ color: "var(--admin-text-secondary)" }}>{commandPlan}</pre>}
    </section>
  );
}

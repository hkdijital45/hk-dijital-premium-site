"use client";

import { RotateCcw } from "lucide-react";

export function DashboardCustomizePanel({
  order,
  hidden,
  labels,
  saving,
  onToggleWidget,
  onReset
}: {
  order: string[];
  hidden: string[];
  labels: Record<string, { label: string; description: string }>;
  saving: boolean;
  onToggleWidget: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <section className="admin-card rounded-[20px] border border-indigo-200 bg-indigo-50 p-5" data-theme-variant="indigo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black" style={{ color: "var(--admin-text-primary)" }}>Dashboard görünümü</h2>
          <p className="mt-1 text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>Bölümleri gösterin veya gizleyin. Tercihler kullanıcı hesabınıza kaydedilir.</p>
        </div>
        <button type="button" disabled={saving} onClick={onReset} className="hk-button hk-button-neutral"><RotateCcw size={17} /> {saving ? "Kaydediliyor..." : "Varsayılanı Yükle"}</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {order.map((id) => {
          const widget = labels[id];
          const visible = !hidden.includes(id);
          return (
            <article key={id} className="flex min-w-0 items-center justify-between gap-3 rounded-[14px] border border-indigo-100 bg-white p-3">
              <span className="min-w-0">
                <strong className="block text-sm text-slate-900">{widget?.label || id}</strong>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{widget?.description || "Dashboard bölümü"}</span>
              </span>
              <button type="button" onClick={() => onToggleWidget(id)} aria-pressed={visible} className={`hk-button hk-button-compact ${visible ? "hk-button-success" : "hk-button-neutral"}`}>{visible ? "Görünür" : "Gizli"}</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

"use client";

import { ChevronRight, Plus, RotateCcw, Settings2 } from "lucide-react";
import type { DashboardQuickAction, NavigateFn } from "./types";

export function DashboardHero({
  greeting,
  userName,
  quickActions,
  onNavigate,
  customizing,
  onToggleCustomizing
}: {
  greeting: string;
  userName: string;
  quickActions: DashboardQuickAction[];
  onNavigate: NavigateFn;
  customizing: boolean;
  onToggleCustomizing: () => void;
}) {
  return (
    <section style={{ order: -20 }} className="hk-dashboard-hero admin-card rounded-[24px] p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black" style={{ color: "var(--nav-accent-text, #0e7490)" }}>{greeting}, {userName}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl" style={{ color: "var(--admin-text-primary)" }}>Bugünün ajans özeti</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>Kritik işleri, müşteri risklerini ve gelir akışını tek bakışta yönetin.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <details className="group relative flex-1 sm:flex-none">
            <summary className="hk-button hk-button-primary min-w-[150px] cursor-pointer list-none justify-center"><Plus size={18} /> Hızlı İşlem</summary>
            <div className="admin-card absolute right-0 z-30 mt-2 grid w-[min(92vw,360px)] gap-2 rounded-[16px] p-3 shadow-2xl">
              {quickActions.map((item) => (
                <button type="button" key={item.label} onClick={() => onNavigate(item.target)} className="hk-button hk-button-neutral justify-start">
                  <span style={{ color: "var(--nav-accent-text, #0e7490)" }}>{item.icon}</span>
                  {item.label}
                  <ChevronRight className="ml-auto" size={16} />
                </button>
              ))}
            </div>
          </details>
          <button type="button" onClick={onToggleCustomizing} aria-pressed={customizing} className="hk-button hk-button-edit"><Settings2 size={18} /> Dashboard&apos;u Düzenle</button>
        </div>
      </div>
      <p className="mt-4 border-t pt-4 text-sm" style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}>Modül favorilerini üst araç çubuğundaki sarı <strong>Favoriler</strong> menüsünden yönetin.</p>
    </section>
  );
}

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

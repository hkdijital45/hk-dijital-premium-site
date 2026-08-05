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
    <section className="admin-card" style={{ borderRadius: "var(--hk-radius-lg)", borderColor: "var(--hk-purple-soft)", background: "var(--hk-purple-soft)", padding: "var(--space-5)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 900, color: "var(--admin-text-primary)" }}>Dashboard görünümü</h2>
          <p style={{ marginTop: 4, fontSize: "var(--text-sm)", lineHeight: "var(--line-sm)", color: "var(--admin-text-secondary)" }}>Bölümleri gösterin veya gizleyin. Tercihler kullanıcı hesabınıza kaydedilir.</p>
        </div>
        <button type="button" disabled={saving} onClick={onReset} className="hk-button hk-button-neutral"><RotateCcw size={17} /> {saving ? "Kaydediliyor..." : "Varsayılanı Yükle"}</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {order.map((id) => {
          const widget = labels[id];
          const visible = !hidden.includes(id);
          return (
            <article key={id} className="flex min-w-0 items-center justify-between gap-3" style={{ borderRadius: "var(--hk-radius-md)", border: "1px solid var(--admin-border)", background: "var(--admin-surface)", padding: "var(--space-3)" }}>
              <span className="min-w-0">
                <strong className="block" style={{ fontSize: "var(--text-sm)", color: "var(--admin-text-primary)" }}>{widget?.label || id}</strong>
                <span className="mt-1 block" style={{ fontSize: "var(--text-xs)", lineHeight: "var(--line-xs)", color: "var(--admin-text-muted)" }}>{widget?.description || "Dashboard bölümü"}</span>
              </span>
              <button type="button" onClick={() => onToggleWidget(id)} aria-pressed={visible} className={`hk-button hk-button-compact ${visible ? "hk-button-success" : "hk-button-neutral"}`}>{visible ? "Görünür" : "Gizli"}</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

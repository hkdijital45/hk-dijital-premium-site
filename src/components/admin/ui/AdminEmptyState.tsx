import type { ReactNode } from "react";

export function AdminEmptyState({
  title,
  description,
  actions
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-card-soft rounded-[16px] border border-dashed p-6 text-center" style={{ borderColor: "var(--admin-border-strong)" }}>
      <h3 className="font-black" style={{ color: "var(--admin-text-primary)" }}>{title}</h3>
      {description && <p className="mt-2 text-sm" style={{ color: "var(--admin-text-secondary)" }}>{description}</p>}
      {actions && <div className="mt-4 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function AdminLoadingState({ label = "Yükleniyor..." }: { label?: string }) {
  return (
    <div className="admin-card-soft flex items-center justify-center gap-2 rounded-[16px] p-6 text-sm font-bold" style={{ color: "var(--admin-text-secondary)" }}>
      <span className="size-2 animate-pulse rounded-full bg-cyan-500" />
      {label}
    </div>
  );
}

export function AdminErrorState({ title = "Bir sorun oluştu", description }: { title?: string; description?: string }) {
  // Colors are set via var(--admin-danger) inline (not the hardcoded
  // .border-red-200/.bg-red-50/.text-red-800/.text-red-700 Tailwind classes
  // this previously used) — those don't adapt to dark mode, and .font-black
  // additionally gets forced to a near-white color by a global dark-mode
  // rule, leaving this card's title unreadable on its own light-red
  // background in dark mode.
  return (
    <div className="rounded-[16px] border p-5 text-sm" style={{ borderColor: "color-mix(in srgb, var(--admin-danger, #dc2626) 35%, transparent)", background: "color-mix(in srgb, var(--admin-danger, #dc2626) 10%, var(--admin-surface))" }}>
      <p style={{ fontWeight: 900, color: "var(--admin-danger, #dc2626)" }}>{title}</p>
      {description && <p className="mt-1 leading-6" style={{ color: "var(--admin-danger, #dc2626)" }}>{description}</p>}
    </div>
  );
}

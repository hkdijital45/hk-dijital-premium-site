import type { CSSProperties, ReactNode } from "react";

export function AdminHero({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = "",
  style
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  /** Extra class names appended to the root card (e.g. a themed gradient hook like "hk-dashboard-hero"). */
  className?: string;
  /** Extra inline styles merged onto the root card (e.g. `{ order: -20 }` to pin position in a reorderable grid). */
  style?: CSSProperties;
}) {
  return (
    <div
      className={`admin-card overflow-hidden rounded-[var(--admin-radius-card,22px)] p-6 sm:p-8 ${className}`.trim()}
      style={{ boxShadow: "var(--admin-shadow-card, var(--admin-shadow))", ...style }}
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-black uppercase tracking-[.18em]" style={{ color: "var(--admin-primary, var(--nav-accent-text, #0e7490))" }}>
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 sm:text-base" style={{ color: "var(--admin-text-secondary)" }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

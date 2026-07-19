import type { ReactNode } from "react";

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-card mb-6 flex flex-wrap items-start justify-between gap-4 rounded-[18px] p-5">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-black uppercase tracking-[.16em]" style={{ color: "var(--nav-accent-text, #0e7490)" }}>{eyebrow}</p>}
        <h2 className="text-2xl font-black" style={{ color: "var(--admin-text-primary)" }}>{title}</h2>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function AdminSection({
  title,
  description,
  actions,
  tone = "default",
  children
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  tone?: "default" | "accent";
  children: ReactNode;
}) {
  return (
    <section className={`admin-card mb-6 rounded-[20px] p-5 ${tone === "accent" ? "border-cyan-200" : ""}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h3 className="font-black" style={{ color: "var(--admin-text-primary)" }}>{title}</h3>}
            {description && <p className="mt-1 text-xs" style={{ color: "var(--admin-text-secondary)" }}>{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

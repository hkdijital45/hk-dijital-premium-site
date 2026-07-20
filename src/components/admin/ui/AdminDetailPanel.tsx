import type { ReactNode } from "react";

export type AdminDetailField = { label: string; value: ReactNode };

/**
 * Read-only key/value summary block for detail views (customer/lead/deal
 * side panels). Desktop: 2-column grid. Mobile: single column, no overflow.
 */
export function AdminDetailPanel({
  title,
  fields,
  actions,
  children
}: {
  title?: string;
  fields?: AdminDetailField[];
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="admin-card min-w-0 rounded-[var(--admin-radius-card,22px)] p-5"
      style={{ boxShadow: "var(--admin-shadow-card, var(--admin-shadow))" }}
    >
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h3 className="font-black" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>{title}</h3>}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {fields && fields.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="min-w-0 rounded-[12px] p-3" style={{ background: "var(--admin-surface-muted, var(--admin-surface-soft))" }}>
              <p className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>{field.label}</p>
              <p className="mt-1 break-words text-sm font-bold" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>{field.value}</p>
            </div>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

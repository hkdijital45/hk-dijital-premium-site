import type { ReactNode } from "react";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import type { AdminDetailField } from "@/components/admin/ui/AdminDetailPanel";

/**
 * Right-side record inspector for a workspace: selected-row summary, quick
 * fields, notes/activity slots, quick actions. Independent scroll region.
 */
export function AdminDetailInspector({
  title,
  subtitle,
  fields,
  actions,
  emptyTitle = "Bir kayıt seçin",
  emptyDescription,
  children
}: {
  title?: string;
  subtitle?: string;
  fields?: AdminDetailField[];
  actions?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  children?: ReactNode;
}) {
  if (!title) {
    return (
      <div className="admin-detail-inspector premium-scrollbar">
        <AdminEmptyState title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="admin-detail-inspector premium-scrollbar">
      <div className="admin-detail-inspector-head">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {fields && fields.length > 0 && (
        <div className="admin-detail-inspector-fields">
          {fields.map((field) => (
            <div key={field.label} className="admin-detail-inspector-field">
              <p>{field.label}</p>
              <p>{field.value}</p>
            </div>
          ))}
        </div>
      )}
      {children}
      {actions && <div className="admin-detail-inspector-actions">{actions}</div>}
    </div>
  );
}

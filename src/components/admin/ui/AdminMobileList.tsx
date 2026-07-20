import type { ReactNode } from "react";
import { AdminEmptyState } from "./AdminEmptyState";

export type AdminMobileListItem = {
  id: string;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  badge?: ReactNode;
  onClick?: () => void;
};

/**
 * Compact single-column list for mobile screens where a full AdminDataTable
 * would be overkill (notifications, activity feeds, search results).
 */
export function AdminMobileList({
  items,
  emptyTitle = "Kayıt bulunamadı",
  emptyDescription
}: {
  items: AdminMobileListItem[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!items.length) {
    return <AdminEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const Tag = item.onClick ? "button" : "div";
        return (
          <Tag
            key={item.id}
            type={item.onClick ? "button" : undefined}
            onClick={item.onClick}
            className={`admin-card-soft flex min-w-0 items-center justify-between gap-3 rounded-[14px] p-3 text-left ${item.onClick ? "transition hover:-translate-y-0.5" : ""}`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-black" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>{item.title}</p>
              {item.subtitle && <p className="mt-0.5 truncate text-xs" style={{ color: "var(--admin-text-secondary)" }}>{item.subtitle}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {item.badge}
              {item.meta && <span className="text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{item.meta}</span>}
            </div>
          </Tag>
        );
      })}
    </div>
  );
}

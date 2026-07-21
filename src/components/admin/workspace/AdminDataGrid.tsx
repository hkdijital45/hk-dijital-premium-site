import type { ReactNode } from "react";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";

export type AdminDataGridColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
};

/**
 * Dense desktop data grid: sticky header, selectable rows, active-row
 * highlighting (drives a right inspector), compact row height. Falls back
 * to a mobile card list below 1024px, same as AdminDataTable.
 */
export function AdminDataGrid<T extends { id?: string | number }>({
  columns,
  rows,
  rowKey,
  selectedIds,
  onToggleSelect,
  activeId,
  onRowClick,
  emptyTitle = "Kayıt bulunamadı",
  emptyDescription,
  emptyActions
}: {
  columns: AdminDataGridColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  activeId?: string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActions?: ReactNode;
}) {
  if (!rows.length) {
    return <AdminEmptyState title={emptyTitle} description={emptyDescription} actions={emptyActions} />;
  }

  return (
    <>
      <div className="admin-data-grid-scroll premium-scrollbar hidden md:block">
        <table className="admin-data-grid">
          <thead>
            <tr>
              {onToggleSelect && <th className="admin-data-grid-select-col" />}
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width, textAlign: col.align || "left" }}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const key = rowKey(row, index);
              const isActive = activeId === key;
              const isSelected = selectedIds?.includes(key);
              return (
                <tr
                  key={key}
                  className={`${isActive ? "is-active" : ""} ${onRowClick ? "is-clickable" : ""}`}
                  onClick={() => onRowClick?.(row)}
                >
                  {onToggleSelect && (
                    <td className="admin-data-grid-select-col" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" checked={Boolean(isSelected)} onChange={() => onToggleSelect(key)} />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} style={{ textAlign: col.align || "left" }}>{col.render(row)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 md:hidden">
        {rows.map((row, index) => {
          const key = rowKey(row, index);
          return (
            <div key={key} className="admin-card min-w-0 rounded-[12px] p-3" onClick={() => onRowClick?.(row)}>
              <div className="grid gap-1.5">
                {columns.map((col) => (
                  <div key={col.key} className="flex min-w-0 items-start justify-between gap-3 text-sm">
                    <span className="shrink-0 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>{col.header}</span>
                    <span className="min-w-0 text-right" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>{col.render(row)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

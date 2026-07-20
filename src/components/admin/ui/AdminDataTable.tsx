import type { ReactNode } from "react";
import { AdminEmptyState } from "./AdminEmptyState";

export type AdminDataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
};

/**
 * Desktop table + mobile card list for the same rows/columns, so callers
 * don't hand-roll a second markup tree per screen. Falls back to
 * AdminEmptyState when rows is empty.
 */
export function AdminDataTable<T extends { id?: string | number }>({
  columns,
  rows,
  rowKey,
  emptyTitle = "Kayıt bulunamadı",
  emptyDescription,
  actions
}: {
  columns: AdminDataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: (row: T) => ReactNode;
}) {
  if (!rows.length) {
    return <AdminEmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-[16px] border md:block" style={{ borderColor: "var(--admin-border)" }}>
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr style={{ background: "var(--admin-surface-muted, var(--admin-surface-soft))" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-black uppercase tracking-wide ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                  style={{ color: "var(--admin-text-muted)" }}
                >
                  {col.header}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>İşlem</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={rowKey(row, index)} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`min-w-0 px-4 py-3 align-top ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}
                    style={{ color: "var(--admin-text, var(--admin-text-primary))" }}
                  >
                    {col.render(row)}
                  </td>
                ))}
                {actions && <td className="px-4 py-3 text-right"><div className="flex flex-wrap justify-end gap-2">{actions(row)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row, index) => (
          <div key={rowKey(row, index)} className="admin-card min-w-0 rounded-[16px] p-4">
            <div className="grid gap-2">
              {columns.map((col) => (
                <div key={col.key} className="flex min-w-0 items-start justify-between gap-3 text-sm">
                  <span className="shrink-0 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>{col.header}</span>
                  <span className="min-w-0 text-right" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>{col.render(row)}</span>
                </div>
              ))}
            </div>
            {actions && <div className="mt-3 flex flex-wrap justify-end gap-2 border-t pt-3" style={{ borderColor: "var(--admin-border)" }}>{actions(row)}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

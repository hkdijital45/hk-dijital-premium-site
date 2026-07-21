import type { ReactNode } from "react";

/** Sticky bottom action/status bar: result count + real connected actions. */
export function AdminActionBar({
  statusText,
  children
}: {
  statusText?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="admin-action-bar">
      {statusText && <span className="admin-action-bar-status">{statusText}</span>}
      <div className="admin-action-bar-actions">{children}</div>
    </div>
  );
}

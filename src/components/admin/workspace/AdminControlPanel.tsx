import type { ReactNode } from "react";

/** Left control panel: search + filter sections + quick actions, independent scroll. */
export function AdminControlPanel({ children }: { children: ReactNode }) {
  return <div className="admin-control-panel premium-scrollbar">{children}</div>;
}

export function AdminFilterSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-filter-section">
      <h4 className="admin-filter-section-title">{title}</h4>
      {children}
    </section>
  );
}

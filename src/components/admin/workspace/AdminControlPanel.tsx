import type { ReactNode } from "react";

/** Left control panel: search + filter sections + quick actions, independent scroll. */
export function AdminControlPanel({ children }: { children: ReactNode }) {
  return <div className="admin-control-panel premium-scrollbar">{children}</div>;
}

export function AdminFilterSection({
  title,
  children,
  collapsible = false,
  defaultOpen = false
}: {
  title: string;
  children: ReactNode;
  /** Folds the section behind a <details> disclosure — for secondary
   * filters that would otherwise turn the panel into a wall of controls
   * (e.g. Müşteri Keşfi's advanced score/volume/digital-asset filters). */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  if (collapsible) {
    return (
      <section className="admin-filter-section">
        <details open={defaultOpen}>
          <summary className="admin-filter-section-title cursor-pointer select-none">{title}</summary>
          <div className="mt-3">{children}</div>
        </details>
      </section>
    );
  }
  return (
    <section className="admin-filter-section">
      <h4 className="admin-filter-section-title">{title}</h4>
      {children}
    </section>
  );
}

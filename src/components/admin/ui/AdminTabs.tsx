"use client";

export function AdminTabs({
  items,
  active,
  onChange,
  ariaLabel = "Sekmeler",
  sticky = false
}: {
  items: readonly string[];
  active: string;
  onChange: (tab: string) => void;
  ariaLabel?: string;
  /** Pins the tab bar to the top of its scroll container — for long, deep-tabbed panels (e.g. Customer 360). */
  sticky?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`premium-scrollbar mb-5 flex gap-2 overflow-x-auto rounded-[16px] p-1.5 ${sticky ? "sticky top-0 z-20 border-b" : ""}`}
      style={{ background: sticky ? "var(--admin-surface-raised, var(--admin-surface))" : "var(--admin-surface-muted, var(--admin-surface-soft))", borderColor: sticky ? "var(--admin-border)" : undefined }}
    >
      {items.map((item) => {
        const isActive = item === active;
        return (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item)}
            className="shrink-0 rounded-[12px] px-3.5 py-2 text-xs font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={isActive
              ? { background: "var(--admin-primary, var(--hk-primary))", color: "#fff" }
              : { color: "var(--admin-text-secondary)" }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

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
            // Font size/weight are set inline, not via `text-xs`/`font-black`
            // utility classes — two separate global rules
            // (`.hk-admin .text-xs { color: ...!important }` and
            // `.hk-admin .font-black { color: ...!important }`, both meant to
            // fix hardcoded-light-text elsewhere) would otherwise force their
            // own color onto the active tab too, defeating the inline white
            // text below with no way for it to win back.
            className="shrink-0 rounded-[12px] px-3.5 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={isActive
              ? { fontSize: "0.75rem", lineHeight: "1rem", fontWeight: 900, background: "var(--admin-primary, var(--hk-primary))", color: "#fff", outlineColor: "var(--hk-focus-ring)" }
              : { fontSize: "0.75rem", lineHeight: "1rem", fontWeight: 900, color: "var(--admin-text-secondary)", outlineColor: "var(--hk-focus-ring)" }}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

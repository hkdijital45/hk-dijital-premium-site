import { useRef } from "react";
import { LayoutDashboard } from "lucide-react";
import { adminCategoryIcons, groupAccentStyle, withAdminEmoji } from "@/lib/admin-nav-presentation";
import { AdminMegaMenuPanel } from "./AdminMegaMenuPanel";

/**
 * Desktop top navigation row (lg+): the 9 module groups render as top-level
 * tabs; clicking one reveals a large, centered mega-menu panel
 * (AdminMegaMenuPanel) anchored to this row rather than a small dropdown
 * pinned under the individual button. This is the DEFAULT desktop chrome —
 * it replaces the old persistent left sidebar rail. Below lg,
 * AdminMobileNavigation's slide-in drawer is used instead (a mega-menu
 * doesn't work at that width), triggered from the same hamburger button in
 * AdminTopHeader.
 *
 * Open/close state (`openGroups`/`onToggleGroup`) is owned by the shell
 * (AdminDashboard / AdminStandaloneShell) and already implements "only one
 * group open at a time" plus outside-click/Escape-to-close — the same state
 * that used to drive the sidebar accordion now drives this mega-menu.
 *
 * The panel is rendered as a sibling of the trigger `<nav>` (not nested
 * inside it) so it isn't clipped by the row's own `overflow-x-auto` scroll
 * container, and centered against this component's outer wrapper via
 * `absolute left-1/2 -translate-x-1/2` so it reads as one panel centered
 * under the sticky header rather than anchored to whichever button opened
 * it.
 */
export function AdminMegaNav({
  groups,
  active,
  openGroups,
  onToggleGroup
}: {
  groups: Array<{ label: string; icon: string; items: Array<{ label: string; slug: string; description?: string }> }>;
  active: string;
  openGroups: Record<string, boolean>;
  onToggleGroup: (label: string) => void;
}) {
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const openGroup = groups.find((group) => openGroups[group.label]);

  return (
    <div className="admin-mega-nav-wrap relative min-w-0" style={groupAccentStyle("")}>
      <nav aria-label="Modül grupları" data-admin-nav="true" className="admin-mega-nav premium-scrollbar flex min-w-0 items-center gap-1.5 overflow-x-auto">
        {groups.map((group) => {
          const CategoryIcon = adminCategoryIcons[group.icon] || LayoutDashboard;
          const expanded = Boolean(openGroups[group.label]);
          const activeInGroup = group.items.some((item) => item.label === active || (item.slug === "" && active === "Dashboard"));
          return (
            <button
              key={group.label}
              ref={(element) => {
                triggerRefs.current[group.label] = element;
              }}
              type="button"
              onClick={() => onToggleGroup(group.label)}
              aria-expanded={expanded}
              aria-haspopup="true"
              className={`admin-category-button flex shrink-0 items-center gap-2 px-3 py-2 text-xs font-black ${activeInGroup ? "admin-category-button-active" : ""}`}
            >
              <span className="admin-category-icon grid size-7 shrink-0 place-items-center rounded-[8px]">
                <CategoryIcon size={14} />
              </span>
              <span className="hidden truncate xl:inline">{withAdminEmoji(group.label)}</span>
            </button>
          );
        })}
      </nav>
      {openGroup && (
        <AdminMegaMenuPanel
          group={openGroup}
          active={active}
          onClose={() => onToggleGroup(openGroup.label)}
          // A getter, not the resolved element: reading `triggerRefs.current`
          // must happen when the panel actually needs it (inside its own
          // effect/event handlers), never synchronously during this
          // component's own render pass.
          getTriggerElement={() => triggerRefs.current[openGroup.label] ?? null}
        />
      )}
    </div>
  );
}

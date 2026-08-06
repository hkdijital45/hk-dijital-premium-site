import { LayoutDashboard } from "lucide-react";
import { adminCategoryIcons, groupAccentStyle, withAdminEmoji } from "@/lib/admin-nav-presentation";
import { getAdminHref } from "@/lib/admin-navigation";
import { AdminSidebarItem } from "./AdminSidebarItem";

/**
 * Desktop top navigation row (lg+): the 9 module groups render as top-level
 * tabs; clicking one reveals a mega-menu panel of that group's items right
 * below it. This is the DEFAULT desktop chrome — it replaces the old
 * persistent left sidebar rail. Below lg, AdminMobileNavigation's slide-in
 * drawer is used instead (a mega-menu doesn't work at that width), triggered
 * from the same hamburger button in AdminTopHeader.
 *
 * Open/close state (`openGroups`/`onToggleGroup`) is owned by the shell
 * (AdminDashboard / AdminStandaloneShell) and already implements "only one
 * group open at a time" plus outside-click/Escape-to-close — the same state
 * that used to drive the sidebar accordion now drives this dropdown.
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
  return (
    <nav aria-label="Modül grupları" className="admin-mega-nav premium-scrollbar flex min-w-0 items-center gap-1.5 overflow-x-auto">
      {groups.map((group) => {
        const CategoryIcon = adminCategoryIcons[group.icon] || LayoutDashboard;
        const expanded = Boolean(openGroups[group.label]);
        const activeInGroup = group.items.some((item) => item.label === active || (item.slug === "" && active === "Dashboard"));
        return (
          <div key={group.label} data-admin-nav="true" className="relative shrink-0" style={groupAccentStyle(group.label)}>
            <button
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
            {expanded && (
              <div
                role="menu"
                aria-label={group.label}
                className="admin-mega-menu absolute left-0 top-[calc(100%+8px)] z-50 grid w-[min(90vw,560px)] grid-cols-1 gap-1.5 border p-3 sm:grid-cols-2"
              >
                {group.items.map((item) => (
                  <AdminSidebarItem
                    key={`${group.label}-${item.label}`}
                    href={getAdminHref(item.slug)}
                    label={item.label}
                    description={item.description}
                    icon={adminCategoryIcons[group.icon] || LayoutDashboard}
                    active={active === item.label || (item.slug === "" && active === "Dashboard")}
                    collapsed={false}
                    variant="mega"
                    onNavigate={() => onToggleGroup(group.label)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

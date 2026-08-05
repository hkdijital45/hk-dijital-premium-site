import { ChevronDown, LayoutDashboard } from "lucide-react";
import { adminCategoryIcons, groupAccentStyle, withAdminEmoji } from "@/lib/admin-nav-presentation";
import { getAdminHref } from "@/lib/admin-navigation";
import { AdminSidebarItem } from "./AdminSidebarItem";

export function AdminSidebarGroup({
  group,
  active,
  expanded,
  collapsed,
  onToggle,
  onNavigate
}: {
  group: { label: string; icon: string; items: Array<{ label: string; slug: string; description?: string }> };
  active: string;
  expanded: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const CategoryIcon = adminCategoryIcons[group.icon] || LayoutDashboard;
  const activeInGroup = group.items.some((item) => item.label === active || (item.slug === "" && active === "Dashboard"));

  return (
    <div data-admin-nav="true" style={groupAccentStyle(group.label)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={`admin-sidebar-group-header flex w-full items-center gap-2 px-2 py-2 text-left text-[11px] font-black uppercase tracking-wide admin-sidebar-group-label ${collapsed ? "justify-center" : "justify-between"}`}
      >
        {!collapsed && <span className="truncate">{withAdminEmoji(group.label)}</span>}
        {collapsed ? (
          <span className={`grid size-6 place-items-center rounded-full ${activeInGroup ? "admin-nav-count" : ""}`}>
            <CategoryIcon size={13} />
          </span>
        ) : (
          <ChevronDown size={13} className={`shrink-0 transition ${expanded ? "rotate-180" : ""}`} />
        )}
      </button>
      {(expanded || collapsed) && (
        <div className="grid gap-1.5 pb-3">
          {group.items.map((item) => (
            <AdminSidebarItem
              key={`${group.label}-${item.label}`}
              href={getAdminHref(item.slug)}
              label={item.label}
              description={collapsed ? undefined : item.description}
              icon={adminCategoryIcons[group.icon] || LayoutDashboard}
              active={active === item.label}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { adminCategoryIcons, adminGroupAccents, groupAccentStyle } from "@/lib/admin-nav-presentation";

export type DesktopToolbarGroup = {
  label: string;
  icon: string;
  items: Array<{ label: string; slug: string }>;
};

/**
 * Compact, colorful horizontal module toolbar sitting under the title bar —
 * one button per center (real adminNavigationGroups data, same source the
 * sidebar uses). Complements the sidebar rather than replacing it: clicking
 * a button opens that center's first/dashboard item.
 */
export function DesktopModuleToolbar({
  groups,
  activeGroupLabel,
  getHref
}: {
  groups: DesktopToolbarGroup[];
  activeGroupLabel?: string;
  getHref: (slug: string) => string;
}) {
  if (!groups.length) return null;

  return (
    <nav className="admin-module-toolbar premium-scrollbar" aria-label="Ana merkezler">
      {groups.map((group) => {
        const Icon = adminCategoryIcons[group.icon] || LayoutDashboard;
        const firstItem = group.items[0];
        const isActive = group.label === activeGroupLabel;
        const accent = adminGroupAccents[group.label] || adminGroupAccents.Sistem;
        return (
          <Link
            key={group.label}
            href={firstItem ? getHref(firstItem.slug) : "/hk-admin"}
            aria-current={isActive}
            className="admin-module-toolbar-btn"
            style={groupAccentStyle(group.label)}
          >
            <span className="admin-module-toolbar-icon" style={{ background: accent.solid }}>
              <Icon size={13} />
            </span>
            {group.label}
          </Link>
        );
      })}
    </nav>
  );
}

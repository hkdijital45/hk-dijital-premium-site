import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { withAdminEmoji } from "@/lib/admin-nav-presentation";

export function AdminSidebarItem({
  href,
  label,
  description,
  icon: Icon,
  active,
  collapsed,
  onNavigate
}: {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={`admin-sidebar-item flex items-start gap-3 px-3 py-2.5 text-sm font-bold ${active ? "admin-sidebar-item-active" : ""} ${collapsed ? "justify-center" : ""}`}
    >
      <span className="admin-sidebar-icon grid size-8 shrink-0 place-items-center rounded-[9px]">
        <Icon size={15} />
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block whitespace-normal break-normal leading-5">{withAdminEmoji(label)}</span>
          {description && <span className="mt-0.5 line-clamp-1 block whitespace-normal break-normal text-[11px] font-medium leading-4 opacity-70">{description}</span>}
        </span>
      )}
    </Link>
  );
}

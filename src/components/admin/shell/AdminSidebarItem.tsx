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
  onNavigate,
  variant = "sidebar"
}: {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  /** "sidebar" renders the vertical drawer/accordion look; "mega" renders the
   *  desktop top-nav mega-menu tile look. Both share this single item
   *  renderer so there is exactly one place the nav item tree is drawn. */
  variant?: "sidebar" | "mega";
}) {
  const isMega = variant === "mega";
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      onClick={onNavigate}
      className={
        isMega
          ? `admin-mega-item flex items-start gap-3 rounded-[14px] px-3.5 py-3 text-sm font-bold ${active ? "admin-mega-item-active" : ""}`
          : `admin-sidebar-item flex items-start gap-3 px-3.5 py-3 text-sm font-bold ${active ? "admin-sidebar-item-active" : ""} ${collapsed ? "justify-center" : ""}`
      }
    >
      <span className={`${isMega ? "admin-mega-item-icon" : "admin-sidebar-icon"} grid size-9 shrink-0 place-items-center rounded-[10px]`}>
        <Icon size={16} />
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

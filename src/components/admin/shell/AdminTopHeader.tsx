import type { ReactNode } from "react";
import { Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";

export function AdminTopHeader({
  logo,
  commandCenter,
  title,
  breadcrumb,
  theme,
  onToggleTheme,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileNav,
  children
}: {
  logo: ReactNode;
  commandCenter?: ReactNode;
  title?: string;
  breadcrumb?: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
  children: ReactNode;
}) {
  return (
    <header className="admin-top-header sticky top-0 z-40 border-b">
      <div className="relative flex min-w-0 flex-wrap items-center gap-3 px-3 py-3 sm:px-4 lg:px-6">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Menüyü aç"
          className="admin-icon-action grid size-10 shrink-0 place-items-center rounded-[10px] lg:hidden"
        >
          <Menu size={18} />
        </button>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarCollapsed ? "Kenar menüsünü genişlet" : "Kenar menüsünü daralt"}
          className="admin-icon-action hidden size-10 shrink-0 place-items-center rounded-[10px] lg:grid"
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:min-w-[180px] 2xl:flex-none">
          {logo}
          {(title || breadcrumb) && (
            <div className="hidden min-w-0 border-l border-[var(--admin-border)] pl-3 lg:block">
              {breadcrumb && <p className="truncate text-[10px] font-bold uppercase tracking-[.16em] admin-sidebar-group-label">{breadcrumb}</p>}
              {title && <p className="truncate text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>{title}</p>}
            </div>
          )}
          {commandCenter && <div className="ml-1 shrink-0">{commandCenter}</div>}
        </div>
        <div className="admin-header-actions order-2 flex w-full min-w-0 flex-wrap items-center gap-2 2xl:order-none 2xl:ml-auto 2xl:w-auto 2xl:justify-end">
          {children}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Aydınlık temaya geç" : "Karanlık temaya geç"}
            className="admin-theme-toggle size-10 shrink-0"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>
    </header>
  );
}

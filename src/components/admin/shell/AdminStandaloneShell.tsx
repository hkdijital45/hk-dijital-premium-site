"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { adminNavigationGroups, getAdminHref } from "@/lib/admin-navigation";
import { canViewAccounting, type AccountingSessionLike } from "@/lib/accounting-permissions";
import { AdminAppShell } from "./AdminAppShell";
import { AdminSidebar } from "./AdminSidebar";
import { AdminMobileNavigation } from "./AdminMobileNavigation";
import { AdminTopHeader } from "./AdminTopHeader";
import { DesktopModuleToolbar } from "./DesktopModuleToolbar";

export function AdminStandaloneShell({
  currentSession,
  allowedModules,
  activeLabel,
  title,
  children
}: {
  currentSession: AccountingSessionLike;
  allowedModules: string[];
  activeLabel: string;
  title: string;
  children: ReactNode;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const visibleNavigationGroups = adminNavigationGroups
    .filter((group) => group.label !== "Finans" || canViewAccounting(currentSession))
    .map((group) => ({ ...group, items: group.items.filter((item) => allowedModules.includes(item.module)) }))
    .filter((group) => group.items.length);
  const activeToolbarGroup = visibleNavigationGroups.find((group) => group.items.some((item) => item.label === activeLabel));

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem("hk-admin-theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only read of persisted theme, matches AdminDashboard's pattern
      if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
      else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setTheme("dark");
    } catch {}
    try {
      setSidebarCollapsed(localStorage.getItem("hk-admin-sidebar-collapsed") === "true");
    } catch {}
    const activeGroup = visibleNavigationGroups.find((group) => group.items.some((item) => item.label === activeLabel));
    if (activeGroup) setOpenGroups({ [activeGroup.label]: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try { localStorage.setItem("hk-admin-theme", next); } catch {}
      return next;
    });
  }

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      try { localStorage.setItem("hk-admin-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }

  function toggleGroup(label: string) {
    setOpenGroups((current) => ({ ...current, [label]: !current[label] }));
  }

  return (
    <AdminAppShell
      theme={theme}
      mobileOperationMode={false}
      header={
        <AdminTopHeader
          logo={
            <span className="flex items-center gap-2 font-black" style={{ color: "var(--admin-text-primary)" }}>
              <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-cyan-400 to-blue-600 text-xs text-white">HK</span>
              HK Dijital
            </span>
          }
          title={title}
          breadcrumb="HK Operating System"
          theme={theme}
          onToggleTheme={toggleTheme}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebarCollapsed}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        >
          <Link href="/hk-admin" className="hk-button hk-button-neutral hk-button-compact">Panele Dön</Link>
        </AdminTopHeader>
      }
      moduleToolbar={
        <DesktopModuleToolbar
          groups={visibleNavigationGroups}
          activeGroupLabel={activeToolbarGroup?.label}
          getHref={getAdminHref}
        />
      }
      sidebar={
        <AdminSidebar
          groups={visibleNavigationGroups}
          active={activeLabel}
          openGroups={openGroups}
          onToggleGroup={toggleGroup}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
        />
      }
      mobileNav={
        <AdminMobileNavigation
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          groups={visibleNavigationGroups}
          active={activeLabel}
          openGroups={openGroups}
          onToggleGroup={toggleGroup}
        />
      }
    >
      {children}
    </AdminAppShell>
  );
}

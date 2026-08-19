"use client";

import { useEffect, useState, type ReactNode } from "react";
import { adminNavigationGroups, getAdminHref } from "@/lib/admin-navigation";
import { canViewAccounting, type AccountingSessionLike } from "@/lib/accounting-permissions";
import { AdminAppShell } from "./AdminAppShell";
import { AdminMegaNav } from "./AdminMegaNav";
import { AdminMobileNavigation } from "./AdminMobileNavigation";
import { AdminTopHeader } from "./AdminTopHeader";
import { HKCommandCenter } from "@/components/admin/command/HKCommandCenter";

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
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const visibleNavigationGroups = adminNavigationGroups
    .filter((group) => group.label !== "Finans" || canViewAccounting(currentSession))
    .map((group) => ({ ...group, items: group.items.filter((item) => allowedModules.includes(item.module)) }))
    .filter((group) => group.items.length);

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem("hk-admin-theme");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only read of persisted theme, matches AdminDashboard's pattern
      if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
      else if (window.matchMedia?.("(prefers-color-scheme: light)").matches) setTheme("light");
    } catch {}
    const activeGroup = visibleNavigationGroups.find((group) => group.items.some((item) => item.label === activeLabel));
    if (activeGroup) setOpenGroups({ [activeGroup.label]: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirrors AdminDashboard's outside-click/Escape-to-close behavior for the
  // desktop mega-nav dropdown (mobile drawer closes itself via its own X /
  // overlay). Every AdminMegaNav group panel is wrapped in
  // `[data-admin-nav]`, so clicks inside an open panel don't self-close it.
  useEffect(() => {
    function closeMenus() {
      setOpenGroups(Object.fromEntries(visibleNavigationGroups.map((group) => [group.label, false])));
    }
    function handlePointerDown(event: MouseEvent) {
      if ((event.target as HTMLElement | null)?.closest("[data-admin-nav]")) return;
      closeMenus();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenus();
    }
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try { localStorage.setItem("hk-admin-theme", next); } catch {}
      return next;
    });
  }

  // Only one group's mega-menu open at a time (matches AdminDashboard).
  function toggleGroup(label: string) {
    setOpenGroups((current) => {
      const nextOpen = !current[label];
      return Object.fromEntries(visibleNavigationGroups.map((group) => [group.label, group.label === label ? nextOpen : false]));
    });
  }

  const commandCenterQuickActions = [
    { label: "Müşteri Ekle", href: "/hk-admin/musteriler", detail: "Yeni müşteri kaydı aç" },
    { label: "Lead Ekle", href: "/hk-admin/leads", detail: "CRM lead listesine git" },
    { label: "Görev Ekle", href: "/hk-admin/gorevler", detail: "Operasyon görevi ekle" },
    { label: "Rapor Oluştur", href: "/hk-admin/musteri-raporlari", detail: "Müşteri raporu hazırla" }
  ];
  const commandCenterGroups = visibleNavigationGroups
    .filter((group) => group.items.length)
    .map((group) => ({ label: group.label, href: getAdminHref(group.items[0].slug) }));

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
          commandCenter={<HKCommandCenter quickActions={commandCenterQuickActions} groups={commandCenterGroups} />}
          title={title}
          breadcrumb="HK Operating System"
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          megaNav={
            <AdminMegaNav
              groups={visibleNavigationGroups}
              active={activeLabel}
              openGroups={openGroups}
              onToggleGroup={toggleGroup}
            />
          }
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

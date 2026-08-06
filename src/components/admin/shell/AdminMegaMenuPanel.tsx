"use client";

import { useEffect, useRef } from "react";
import { LayoutDashboard } from "lucide-react";
import { adminCategoryIcons } from "@/lib/admin-nav-presentation";
import { getAdminHref } from "@/lib/admin-navigation";
import { AdminSidebarItem } from "./AdminSidebarItem";

type AdminNavGroup = {
  label: string;
  icon: string;
  items: Array<{ label: string; slug: string; description?: string }>;
};

const FOCUSABLE_SELECTOR = "a[href], button:not([disabled])";

/**
 * Centered mega-menu overlay for the desktop top nav (lg+). Rendered as a
 * sibling of AdminMegaNav's trigger row (not nested inside it) so it isn't
 * clipped by the row's `overflow-x-auto` scroll container, and positioned
 * with `absolute left-1/2 -translate-x-1/2` against that shared relative
 * wrapper so it reads as one large panel centered under the sticky header
 * rather than a small dropdown pinned to whichever button was clicked.
 *
 * Owns only presentation + focus/keyboard behavior for whichever group is
 * currently open; the open/closed state itself still lives in the shell
 * (AdminDashboard / AdminStandaloneShell) via `openGroups`/`onToggleGroup` —
 * this component never introduces parallel state.
 */
export function AdminMegaMenuPanel({
  group,
  active,
  onClose,
  getTriggerElement
}: {
  group: AdminNavGroup;
  active: string;
  onClose: () => void;
  getTriggerElement: () => HTMLButtonElement | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        getTriggerElement()?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeInsidePanel = panel.contains(document.activeElement);
      // Real focus trap: Tab/Shift+Tab cycle only within the panel's
      // focusable elements while it's open, whether focus starts on the
      // trigger button, the panel itself, or anywhere else on the page.
      if (!activeInsidePanel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    // Capture phase so this runs before the shell's own window-level
    // Escape/outside-click listener, and so Tab can be intercepted no
    // matter which element currently has focus.
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose, getTriggerElement]);

  function handleBackdropClick() {
    onClose();
    getTriggerElement()?.focus();
  }

  function handleItemNavigate() {
    onClose();
  }

  return (
    <>
      <div className="admin-mega-menu-backdrop fixed inset-0 z-40" onClick={handleBackdropClick} aria-hidden="true" />
      <div
        ref={panelRef}
        role="menu"
        aria-label={group.label}
        data-admin-nav="true"
        className="admin-mega-menu premium-scrollbar absolute left-1/2 top-[calc(100%+10px)] z-50 w-[min(92vw,1040px)] max-h-[min(70vh,640px)] -translate-x-1/2 overflow-y-auto border p-4"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
              onNavigate={handleItemNavigate}
            />
          ))}
        </div>
      </div>
    </>
  );
}

"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { AdminSidebarGroup } from "./AdminSidebarGroup";

export function AdminMobileNavigation({
  open,
  onClose,
  groups,
  active,
  openGroups,
  onToggleGroup
}: {
  open: boolean;
  onClose: () => void;
  groups: Array<{ label: string; icon: string; items: Array<{ label: string; slug: string; description?: string }> }>;
  active: string;
  openGroups: Record<string, boolean>;
  onToggleGroup: (label: string) => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex lg:hidden">
      <div className="admin-mobile-nav-overlay absolute inset-0" onClick={onClose} />
      <div className="admin-mobile-nav-panel admin-drawer-panel relative flex h-full w-[min(88vw,320px)] flex-col overflow-y-auto premium-scrollbar rounded-r-[18px] p-3">
        <div className="mb-2 flex items-center justify-between px-1 py-1">
          <p className="text-xs font-black uppercase tracking-wide admin-sidebar-group-label">Menü</p>
          <button type="button" onClick={onClose} aria-label="Menüyü kapat" className="admin-icon-action grid size-9 place-items-center rounded-[10px]">
            <X size={17} />
          </button>
        </div>
        {groups.map((group) => (
          <AdminSidebarGroup
            key={group.label}
            group={group}
            active={active}
            expanded={Boolean(openGroups[group.label])}
            collapsed={false}
            onToggle={() => onToggleGroup(group.label)}
            onNavigate={onClose}
          />
        ))}
      </div>
    </div>
  );
}

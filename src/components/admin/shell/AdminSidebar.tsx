import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { AdminSidebarGroup } from "./AdminSidebarGroup";

export function AdminSidebar({
  groups,
  active,
  openGroups,
  onToggleGroup,
  collapsed,
  onToggleCollapsed
}: {
  groups: Array<{ label: string; icon: string; items: Array<{ label: string; slug: string; description?: string }> }>;
  active: string;
  openGroups: Record<string, boolean>;
  onToggleGroup: (label: string) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside
      className={`admin-sidebar premium-scrollbar sticky top-[64px] hidden h-[calc(100vh-80px)] shrink-0 overflow-y-auto rounded-[16px] border lg:flex lg:flex-col ${collapsed ? "lg:w-[76px]" : "lg:w-[268px]"}`}
    >
      <div className="flex-1 px-2 py-3">
        {groups.map((group) => (
          <AdminSidebarGroup
            key={group.label}
            group={group}
            active={active}
            expanded={Boolean(openGroups[group.label])}
            collapsed={collapsed}
            onToggle={() => onToggleGroup(group.label)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Menüyü genişlet" : "Menüyü daralt"}
        className="admin-sidebar-item mx-2 mb-3 flex items-center justify-center gap-2 rounded-[10px] py-2.5 text-xs font-black"
      >
        {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Menüyü daralt</>}
      </button>
    </aside>
  );
}

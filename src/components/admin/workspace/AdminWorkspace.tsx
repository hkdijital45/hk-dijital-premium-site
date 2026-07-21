"use client";

import { useState, type ReactNode } from "react";
import { Filter, SlidersHorizontal, X } from "lucide-react";

/**
 * Shared desktop-software workspace shell used by deeply-migrated /hk-admin
 * modules (Dashboard, Müşteriler, ...). Renders inside the existing
 * AdminAppShell/.admin-desktop-frame — this is the INNER module layout:
 * compact header, optional left control panel, center workspace, optional
 * right inspector, optional sticky bottom action bar.
 *
 * <1024px: left/right panels collapse into slide-over drawers so modules
 * never try to cram 3 columns into a phone screen.
 */
export function AdminWorkspace({
  title,
  eyebrow,
  description,
  headerActions,
  leftPanel,
  leftPanelLabel = "Filtreler",
  rightPanel,
  rightPanelLabel = "Detay",
  bottomBar,
  children
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  headerActions?: ReactNode;
  leftPanel?: ReactNode;
  leftPanelLabel?: string;
  rightPanel?: ReactNode;
  rightPanelLabel?: string;
  bottomBar?: ReactNode;
  children: ReactNode;
}) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  return (
    <div className="admin-workspace">
      <div className="admin-workspace-header">
        <div className="min-w-0">
          {eyebrow && <p className="admin-workspace-eyebrow">{eyebrow}</p>}
          <h2 className="admin-workspace-title">{title}</h2>
          {description && <p className="admin-workspace-description">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {leftPanel && (
            <button type="button" className="hk-button hk-button-neutral hk-button-compact admin-workspace-drawer-toggle" onClick={() => setLeftOpen(true)}>
              <SlidersHorizontal size={14} /> {leftPanelLabel}
            </button>
          )}
          {headerActions}
          {rightPanel && (
            <button type="button" className="hk-button hk-button-neutral hk-button-compact admin-workspace-drawer-toggle" onClick={() => setRightOpen(true)}>
              <Filter size={14} /> {rightPanelLabel}
            </button>
          )}
        </div>
      </div>

      <div className="admin-workspace-body">
        {leftPanel && <div className="admin-workspace-left">{leftPanel}</div>}
        <div className="admin-workspace-center">{children}</div>
        {rightPanel && <div className="admin-workspace-right">{rightPanel}</div>}
      </div>

      {bottomBar && <div className="admin-workspace-bottom">{bottomBar}</div>}

      {leftPanel && leftOpen && (
        <div className="admin-workspace-drawer-overlay" onClick={() => setLeftOpen(false)}>
          <div className="admin-workspace-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="admin-workspace-drawer-head">
              <strong>{leftPanelLabel}</strong>
              <button type="button" aria-label="Kapat" onClick={() => setLeftOpen(false)}><X size={16} /></button>
            </div>
            {leftPanel}
          </div>
        </div>
      )}
      {rightPanel && rightOpen && (
        <div className="admin-workspace-drawer-overlay" onClick={() => setRightOpen(false)}>
          <div className="admin-workspace-drawer admin-workspace-drawer-right" onClick={(event) => event.stopPropagation()}>
            <div className="admin-workspace-drawer-head">
              <strong>{rightPanelLabel}</strong>
              <button type="button" aria-label="Kapat" onClick={() => setRightOpen(false)}><X size={16} /></button>
            </div>
            {rightPanel}
          </div>
        </div>
      )}
    </div>
  );
}

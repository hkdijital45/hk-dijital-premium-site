"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Star, X } from "lucide-react";
import {
  getFavoriteSubItems,
  getRecentSubItems,
  pushRecentSubItem,
  toggleFavoriteSubItem,
  type AdminQuickAccessItem
} from "@/lib/admin-quick-access";

export type AdminCenterPopoverItem = {
  label: string;
  description?: string;
  href: string;
};

export type AdminCenterPopoverAction = {
  label: string;
  href: string;
  icon?: ReactNode;
};

const POPOVER_WIDTH = 400;
const POPOVER_MARGIN = 12;

export function AdminCenterPopover({
  open,
  anchorRect,
  onClose,
  title,
  description,
  items,
  quickActions
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  onClose: () => void;
  title: string;
  description: string;
  items: AdminCenterPopoverItem[];
  quickActions: AdminCenterPopoverAction[];
}) {
  const [favorites, setFavorites] = useState<AdminQuickAccessItem[]>([]);
  const [recents, setRecents] = useState<AdminQuickAccessItem[]>([]);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(getFavoriteSubItems());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecents(getRecentSubItems());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(window.innerWidth < 640);
    const timer = window.setTimeout(() => firstItemRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
    // Reads favorites/recents/viewport once per open — onCloseRef always
    // has the latest callback without forcing this effect to re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const relevantRecents = useMemo(
    () => recents.filter((recent) => items.some((item) => item.href === recent.href)).slice(0, 4),
    [recents, items]
  );

  if (!open) return null;

  function isFav(href: string) {
    return favorites.some((entry) => entry.href === href);
  }

  function handleToggleFavorite(item: AdminCenterPopoverItem) {
    setFavorites(toggleFavoriteSubItem({ href: item.href, label: item.label, centerTitle: title }));
  }

  function handleOpenItem(item: AdminCenterPopoverItem) {
    pushRecentSubItem({ href: item.href, label: item.label, centerTitle: title });
    onClose();
  }

  const style: React.CSSProperties = isMobile || !anchorRect
    ? { left: 0, right: 0, bottom: 0, maxHeight: "80dvh" }
    : (() => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      let left = anchorRect.right + POPOVER_MARGIN;
      if (left + POPOVER_WIDTH > viewportWidth - POPOVER_MARGIN) {
        left = anchorRect.left - POPOVER_WIDTH - POPOVER_MARGIN;
      }
      if (left < POPOVER_MARGIN) left = Math.min(anchorRect.left, viewportWidth - POPOVER_WIDTH - POPOVER_MARGIN);
      let top = anchorRect.top;
      const maxHeight = viewportHeight - top - POPOVER_MARGIN;
      if (maxHeight < 320) top = Math.max(POPOVER_MARGIN, viewportHeight - 320 - POPOVER_MARGIN);
      return { left: Math.max(POPOVER_MARGIN, left), top, width: POPOVER_WIDTH, maxHeight: Math.min(viewportHeight - top - POPOVER_MARGIN, 520) };
    })();

  return (
    <>
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-transparent"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed z-50 flex min-w-0 flex-col overflow-hidden rounded-[22px] border shadow-2xl transition-all duration-200 ${isMobile ? "animate-[hk-popover-slide-up_.2s_ease-out]" : "animate-[hk-popover-fade-scale_.2s_ease-out]"}`}
        style={{ ...style, background: "var(--admin-surface, var(--admin-bg))", borderColor: "var(--admin-border)" }}
      >
        <div className="flex items-start justify-between gap-3 border-b p-4" style={{ borderColor: "var(--admin-border)" }}>
          <div className="min-w-0">
            <h3 className="text-base font-black" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>{title}</h3>
            <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--admin-text-secondary)" }}>{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="grid size-8 shrink-0 place-items-center rounded-full border focus-visible:outline focus-visible:outline-2"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-text-secondary)" }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-y-auto p-2">
          {relevantRecents.length > 0 && (
            <div className="mb-1 px-2 pt-2">
              <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>Son Kullanılanlar</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {relevantRecents.map((recent) => (
                  <Link key={recent.href} href={recent.href} onClick={onClose} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: "var(--admin-surface-muted, var(--admin-surface-soft))", color: "var(--admin-text-secondary)" }}>
                    {recent.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-0.5 p-1">
            {items.map((item, index) => (
              <div key={item.href} className="group flex min-w-0 items-center gap-1 rounded-[12px] px-1">
                <Link
                  ref={index === 0 ? firstItemRef : undefined}
                  href={item.href}
                  onClick={() => handleOpenItem(item)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] p-2.5 text-left transition hover:translate-x-0.5"
                  style={{ color: "var(--admin-text, var(--admin-text-primary))" }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{item.label}</span>
                    {item.description && <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--admin-text-muted)" }}>{item.description}</span>}
                  </span>
                  <ChevronRight size={15} className="shrink-0 opacity-0 transition group-hover:opacity-60" style={{ color: "var(--admin-text-muted)" }} />
                </Link>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(item)}
                  aria-label={isFav(item.href) ? `${item.label} favorilerden çıkar` : `${item.label} favorilere ekle`}
                  aria-pressed={isFav(item.href)}
                  className="grid size-8 shrink-0 place-items-center rounded-full focus-visible:outline focus-visible:outline-2"
                  style={{ color: isFav(item.href) ? "#f59e0b" : "var(--admin-text-muted)" }}
                >
                  <Star size={14} fill={isFav(item.href) ? "currentColor" : "none"} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {quickActions.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t p-3" style={{ borderColor: "var(--admin-border)" }}>
            {quickActions.map((action) => (
              <Link key={action.label} href={action.href} onClick={onClose} className="hk-button hk-button-neutral hk-button-compact">
                {action.icon}
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

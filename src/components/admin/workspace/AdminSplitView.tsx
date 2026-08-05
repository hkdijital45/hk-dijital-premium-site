"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Resizable two-pane split view — the primitive behind the Raycast/ChatGPT
 * Desktop-style AI screens (a narrow drag-to-resize sidebar next to a main
 * content pane). Width persists per-screen via `storageKey`. Below 900px
 * the sidebar stacks above the main pane instead of resizing (drag handle
 * hides itself via CSS), so it never fights mobile layout.
 */
export function AdminSplitView({
  left,
  leftLabel,
  children,
  defaultLeftWidth = 300,
  minLeftWidth = 220,
  maxLeftWidth = 460,
  storageKey
}: {
  left: ReactNode;
  leftLabel?: string;
  children: ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  storageKey?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(defaultLeftWidth);
  const [width, setWidth] = useState(() => {
    if (storageKey && typeof window !== "undefined") {
      const stored = Number(window.localStorage.getItem(storageKey));
      if (stored) return Math.min(maxLeftWidth, Math.max(minLeftWidth, stored));
    }
    return defaultLeftWidth;
  });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMove(event: PointerEvent) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const next = Math.min(maxLeftWidth, Math.max(minLeftWidth, event.clientX - rect.left));
      setWidth(next);
    }
    function onUp() {
      setDragging(false);
      if (storageKey) {
        try { window.localStorage.setItem(storageKey, String(widthRef.current)); } catch {}
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, maxLeftWidth, minLeftWidth, storageKey]);

  return (
    <div ref={containerRef} className={`admin-split-view ${dragging ? "is-dragging" : ""}`}>
      <div className="admin-split-view-left" style={{ width }} aria-label={leftLabel}>
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Paneli yeniden boyutlandır"
        tabIndex={0}
        className="admin-split-view-handle"
        onPointerDown={onPointerDown}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setWidth((current) => Math.max(minLeftWidth, current - 16));
          if (event.key === "ArrowRight") setWidth((current) => Math.min(maxLeftWidth, current + 16));
        }}
      />
      <div className="admin-split-view-main">{children}</div>
    </div>
  );
}

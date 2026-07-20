"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Token-aware drawer: works in light/dark, stays inside the viewport on
 * mobile (full-screen sheet) and desktop (side panel), and closes on Escape
 * or backdrop click.
 */
export function AdminDrawer({
  title,
  description,
  onClose,
  children,
  footer
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "var(--admin-overlay, rgba(15,23,42,.55))" }}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        className="flex h-full w-full max-w-2xl min-w-0 flex-col overflow-hidden border-l shadow-2xl"
        style={{
          background: "var(--admin-surface, var(--admin-bg))",
          borderColor: "var(--admin-border)",
          maxHeight: "100dvh"
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: "var(--admin-border)" }}>
          <div className="min-w-0">
            <h2 className="text-xl font-black" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>{title}</h2>
            {description && <p className="mt-1 text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="grid size-10 shrink-0 place-items-center rounded-full border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-text, var(--admin-text-primary))" }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t p-4" style={{ borderColor: "var(--admin-border)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

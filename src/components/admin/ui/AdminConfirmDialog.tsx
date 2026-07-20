"use client";

import { useEffect } from "react";
import { AdminButton } from "./AdminButton";

/**
 * Token-aware confirmation modal for destructive/important actions. Not a
 * wholesale replacement for every existing window.confirm() call in the
 * codebase (that would touch dozens of unrelated call sites) — intended for
 * new flows and screens that want a branded, accessible confirm step.
 */
export function AdminConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  tone = "danger",
  busy = false,
  onConfirm,
  onCancel
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary" | "warning";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={onCancel}
      className="fixed inset-0 z-[60] grid place-items-center p-4"
      style={{ background: "var(--admin-overlay, rgba(15,23,42,.55))" }}
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-md min-w-0 rounded-[var(--admin-radius-card,22px)] p-5"
        style={{ background: "var(--admin-surface, var(--admin-bg))", boxShadow: "var(--admin-shadow-card, var(--admin-shadow))" }}
      >
        <h2 className="text-lg font-black" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>{title}</h2>
        {description && <p className="mt-2 text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>{description}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <AdminButton variant="secondary" onClick={onCancel} disabled={busy}>{cancelLabel}</AdminButton>
          <AdminButton variant={tone} onClick={onConfirm} loading={busy}>{confirmLabel}</AdminButton>
        </div>
      </div>
    </div>
  );
}

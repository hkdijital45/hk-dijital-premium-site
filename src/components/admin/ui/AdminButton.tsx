"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type AdminButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "ai"
  | "communication"
  | "premium"
  | "ghost"
  | "outline";

const VARIANT_CLASS: Record<AdminButtonVariant, string> = {
  primary: "hk-button-primary",
  secondary: "hk-button-neutral",
  success: "hk-button-success",
  warning: "hk-button-warning",
  danger: "hk-button-danger",
  info: "hk-button-info",
  ai: "hk-button-ai",
  communication: "hk-button-communication",
  premium: "hk-button-edit",
  ghost: "hk-button-neutral",
  outline: "hk-button-neutral"
};

export interface AdminButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: AdminButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
  fullWidthOnMobile?: boolean;
  compact?: boolean;
}

export function AdminButton({
  variant = "secondary",
  icon,
  loading = false,
  fullWidthOnMobile = false,
  compact = false,
  disabled,
  children,
  ...rest
}: AdminButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={`hk-button ${VARIANT_CLASS[variant]} ${compact ? "hk-button-compact" : ""} ${fullWidthOnMobile ? "w-full sm:w-auto" : ""}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function AdminIconButton({
  variant = "secondary",
  icon,
  label,
  loading = false,
  disabled,
  ...rest
}: Omit<AdminButtonProps, "children" | "icon" | "fullWidthOnMobile" | "compact"> & { icon: ReactNode; label: string }) {
  return (
    <button
      type="button"
      {...rest}
      aria-label={label}
      title={label}
      disabled={disabled || loading}
      className={`admin-icon-action grid size-10 place-items-center rounded-[10px] ${VARIANT_CLASS[variant]}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
    </button>
  );
}

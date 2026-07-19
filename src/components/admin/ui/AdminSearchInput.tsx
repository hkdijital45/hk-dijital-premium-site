"use client";

import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

export function AdminSearchInput({
  value,
  onChange,
  placeholder = "Ara...",
  large = false,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  large?: boolean;
}) {
  return (
    <label className={`hk-search-input flex min-w-0 items-center gap-2 rounded-[14px] px-4 ${large ? "min-h-14 text-base" : "min-h-10 text-sm"}`}>
      <Search size={large ? 20 : 16} className="shrink-0" style={{ color: "var(--admin-text-muted)" }} />
      <input
        {...rest}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent font-bold outline-none"
        style={{ color: "var(--admin-text-primary)" }}
      />
    </label>
  );
}

export function AdminFilterBar({
  options,
  active,
  onToggle,
  onClear,
  multi = true
}: {
  options: string[];
  active: string[];
  onToggle: (option: string) => void;
  onClear?: () => void;
  multi?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          type="button"
          key={option}
          onClick={() => onToggle(option)}
          className={multi ? "hk-button hk-button-compact hk-button-neutral" : "hk-button hk-button-compact hk-button-neutral"}
          aria-pressed={active.includes(option)}
          style={active.includes(option) ? { background: "var(--nav-accent, #0891b2)", color: "#fff" } : undefined}
        >
          {option}
        </button>
      ))}
      {onClear && (
        <button type="button" onClick={onClear} className="hk-button hk-button-compact hk-button-neutral">
          Filtreleri temizle
        </button>
      )}
    </div>
  );
}

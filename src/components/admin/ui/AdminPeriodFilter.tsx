"use client";

import { adminPeriodOptions, type AdminPeriodKey } from "@/lib/admin-period-filter";

/**
 * Shared quick-period control for finance workspaces (Tahsilat, Finans,
 * Kârlılık) — one implementation so the six presets and custom-range
 * boundaries behave identically everywhere instead of three separate
 * ad-hoc date pickers.
 */
export function AdminPeriodFilter({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange
}: {
  value: AdminPeriodKey;
  onChange: (key: AdminPeriodKey) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {adminPeriodOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-black ${value === option.key ? "bg-cyan-500 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {value === "custom" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-bold text-slate-700">
            Başlangıç
            <input type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-sm text-slate-900" />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-700">
            Bitiş
            <input type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} className="min-h-9 rounded-[8px] border border-slate-200 bg-white px-2 text-sm text-slate-900" />
          </label>
        </div>
      )}
    </div>
  );
}

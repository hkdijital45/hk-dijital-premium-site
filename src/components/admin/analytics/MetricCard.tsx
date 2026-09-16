"use client";

import { useState } from "react";
import { HelpCircle, TrendingDown, TrendingUp } from "lucide-react";
import { MetricTrendSparkline } from "./charts";
import { platformTheme, type PlatformThemeKey } from "./theme";

// Reusable KPI card (section 17) — a premium, tinted-surface variant per
// platform, never a hardcoded random color. label/value/delta/comparison/
// optional sparkline/tooltip; large radius, minimal shadow, ample padding
// (the "no cramped cards" design brief).
export function MetricCard({
  variant = "neutral", label, value, changePercent, tooltip, sparkline, note
}: {
  variant?: PlatformThemeKey;
  label: string;
  value: string;
  changePercent?: number | null;
  tooltip?: string;
  sparkline?: number[];
  note?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const theme = platformTheme(variant);
  const trendUp = typeof changePercent === "number" && changePercent >= 0;

  return (
    <div className="relative rounded-[18px] p-5" style={{ background: theme.accentSoft, border: `1px solid ${theme.accentBorder}` }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[.08em]" style={{ color: "var(--admin-text-muted)" }}>{label}</p>
        {tooltip && (
          <button type="button" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)} onFocus={() => setShowTooltip(true)} onBlur={() => setShowTooltip(false)} aria-label={`${label} açıklaması`} className="shrink-0" style={{ color: theme.accent }}>
            <HelpCircle size={14} />
          </button>
        )}
      </div>
      <p className="mt-2 text-3xl font-black tracking-tight" style={{ color: "var(--admin-text-primary)" }}>{value}</p>
      {typeof changePercent === "number" ? (
        <p className="mt-2 flex items-center gap-1 text-xs font-bold" style={{ color: trendUp ? "#15803d" : "#dc2626" }}>
          {trendUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(changePercent).toFixed(1)}% önceki döneme göre
        </p>
      ) : note ? (
        <p className="mt-2 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>{note}</p>
      ) : null}
      {sparkline && sparkline.length > 1 && <div className="mt-3"><MetricTrendSparkline data={sparkline} color={theme.accent} /></div>}
      {tooltip && showTooltip && (
        <div role="tooltip" className="absolute left-5 top-full z-10 mt-1 max-w-xs rounded-[10px] bg-slate-900 px-3 py-2 text-xs font-bold leading-5 text-white shadow-lg">
          {tooltip}
        </div>
      )}
    </div>
  );
}

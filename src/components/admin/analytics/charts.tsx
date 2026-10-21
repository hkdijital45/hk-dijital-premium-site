"use client";

import { useId, useState } from "react";

// Premium, reusable, dependency-free chart primitives — this codebase has
// no charting library (recharts/chart.js/etc were never installed); the
// established convention (see src/components/customer/reports/
// CustomerReportCharts.tsx) is hand-rolled SVG. These generalize that
// pattern into real, reusable components (data/color/label as props, not a
// hardcoded metric list) with tooltip, legend, empty and loading states —
// large and clean rather than the old tiny-chart-in-a-tiny-card look.

export type SeriesPoint = { label: string; value: number; compareValue?: number };

function formatNumber(value: number, unit?: string) {
  if (unit === "currency") return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`;
  if (unit === "percent") return `%${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
  if (unit === "seconds") return `${Math.round(value)} sn`;
  return value.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
}

export type ChartTheme = "dark" | "light";

// Both themes' values as LOCAL CSS custom properties (--chart-*), set via
// inline style on this wrapper so they cascade to every descendant that
// already references var(--chart-...) — the dark values are byte-for-byte
// today's --analytics-* tokens (default theme="dark", every existing
// caller — AnalyticsReportingCenter.tsx, PlatformViews.tsx — unaffected);
// "light" is new, for a chart embedded in an otherwise white/light page
// (HK Admin Dashboard V2) that must never show this panel's own
// permanently-dark background.
const THEME_VARS: Record<ChartTheme, Record<string, string>> = {
  dark: {
    "--chart-bg": "var(--analytics-panel-dark)",
    "--chart-border": "var(--analytics-panel-border)",
    "--chart-text": "var(--analytics-text-on-dark)",
    "--chart-text-secondary": "var(--analytics-text-on-dark-secondary)",
    "--chart-text-muted": "var(--analytics-text-on-dark-muted)",
    "--chart-grid": "var(--analytics-chart-grid)",
    "--chart-tooltip-bg": "var(--analytics-chart-tooltip-bg)",
    "--chart-tooltip-text": "var(--analytics-chart-tooltip-text)"
  },
  light: {
    "--chart-bg": "#ffffff",
    "--chart-border": "#e6edf5",
    "--chart-text": "#142238",
    "--chart-text-secondary": "#475569",
    "--chart-text-muted": "#64748b",
    "--chart-grid": "#e6edf5",
    "--chart-tooltip-bg": "#142238",
    "--chart-tooltip-text": "#ffffff"
  }
};

function ChartShell({ title, subtitle, height = 280, empty, loading, theme = "dark", action, children }: { title?: string; subtitle?: string; height?: number; empty?: boolean; loading?: boolean; theme?: ChartTheme; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[16px] p-4"
      style={{
        background: "var(--chart-bg)", border: "1px solid var(--chart-border)", color: "var(--chart-text)",
        boxShadow: theme === "light" ? "0 1px 2px rgba(20,34,56,.04)" : "0 1px 2px rgba(2,6,23,.2), 0 12px 32px rgba(2,6,23,.28)",
        ...(THEME_VARS[theme] as React.CSSProperties)
      }}
    >
      {(title || subtitle || action) && (
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            {/* text-[var(...)] (not style={{color}}) is deliberate: the shared
                admin CSS force-overrides h1-h6/strong/label/th/.font-black/
                .font-bold/p/span/etc with `!important`, which beats an inline
                `style` color — but explicitly excludes any className
                containing the literal `text-[#`/`text-[var(` substring (see
                globals.css's --hk-force-text-color comment). This chart
                panel needs its own fixed colors regardless of the ambient
                admin theme, so every text node in it uses this escape
                hatch, not a style prop. */}
            {title && <h3 className="text-sm font-black text-[var(--chart-text)]">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-[var(--chart-text-secondary)]">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {loading ? (
        <div className="grid place-items-center" style={{ height }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600/20 border-t-cyan-600" />
        </div>
      ) : empty ? (
        <div className="grid place-items-center text-center" style={{ height }}>
          <p className="text-sm font-bold text-[var(--chart-text-secondary)]">Seçili dönemde veri bulunamadı.</p>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// Large, responsive area chart with an optional comparison-period overlay
// (dashed line), hover tooltip and a start/end legend.
export function AnalyticsAreaChart({
  title, subtitle, data, color = "#0891b2", unit, height = 280, loading, theme = "dark", action
}: { title?: string; subtitle?: string; data: SeriesPoint[]; color?: string; unit?: string; height?: number; loading?: boolean; theme?: ChartTheme; action?: React.ReactNode }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const reactId = useId();
  const hasCompare = data.some((d) => d.compareValue !== undefined);
  const values = data.map((d) => d.value);
  const compareValues = data.map((d) => d.compareValue ?? 0);
  const max = Math.max(...values, ...compareValues, 1);
  const chartId = `area-${reactId.replace(/[^a-zA-Z0-9-]/g, "")}`;
  const w = 100;
  const h = 100;
  const pad = 6;
  const xFor = (i: number) => (data.length > 1 ? (i * (w - pad * 2)) / (data.length - 1) + pad : w / 2);
  const yFor = (value: number) => h - pad - (value / max) * (h - pad * 2);
  const linePoints = data.map((d, i) => `${xFor(i)},${yFor(d.value)}`).join(" ");
  const comparePoints = hasCompare ? data.map((d, i) => `${xFor(i)},${yFor(d.compareValue || 0)}`).join(" ") : "";
  const areaPath = `M${pad},${h - pad} L${linePoints.split(" ").join(" L")} L${xFor(data.length - 1)},${h - pad} Z`;

  return (
    <ChartShell title={title} subtitle={subtitle} height={height} empty={!data.length} loading={loading} theme={theme} action={action}>
      <div className="flex items-center gap-4 text-xs font-bold text-[var(--chart-text-secondary)]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />Bu dönem</span>
        {hasCompare && <span className="flex items-center gap-1.5"><span className="h-0.5 w-3" style={{ background: color, opacity: 0.4 }} />Karşılaştırma</span>}
      </div>
      <div className="relative mt-3" style={{ height: height - 60 }}>
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label={title || "trend grafiği"}>
          <defs>
            <linearGradient id={chartId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity=".28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="var(--chart-grid)" strokeWidth="0.5" />
          <path d={areaPath} fill={`url(#${chartId})`} stroke="none" />
          {hasCompare && <polyline fill="none" stroke={color} strokeOpacity="0.35" strokeDasharray="3,2" strokeWidth="1.5" points={comparePoints} />}
          <polyline fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" points={linePoints} />
          {data.map((d, i) => (
            <circle key={i} cx={xFor(i)} cy={yFor(d.value)} r={hoverIndex === i ? 2.2 : 0} fill={color} />
          ))}
          {/* invisible hit-targets for hover, one per point, in real pixel space via foreignObject-free rects */}
          {data.map((d, i) => (
            <rect key={`hit-${i}`} x={xFor(i) - (w / Math.max(data.length, 1)) / 2} y={0} width={w / Math.max(data.length, 1)} height={h}
              fill="transparent" onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex((current) => (current === i ? null : current))} />
          ))}
        </svg>
        {hoverIndex !== null && data[hoverIndex] && (
          <div className="pointer-events-none absolute top-0 rounded-[10px] px-3 py-2 text-xs font-bold shadow-lg" style={{ left: `${xFor(hoverIndex)}%`, transform: "translateX(-50%)", background: "var(--chart-tooltip-bg)" }}>
            {/* Every <p> below needs its own text-[var(...)] — the shared
                admin CSS force-overrides plain p/span/etc with `!important`
                per-element, so a color set on the parent div is not enough. */}
            <p className="text-[10px] font-black uppercase tracking-wide text-[var(--chart-tooltip-text)] opacity-80">{data[hoverIndex].label}</p>
            <p className="text-[var(--chart-tooltip-text)]">{formatNumber(data[hoverIndex].value, unit)}</p>
            {hasCompare && <p className="text-[var(--chart-tooltip-text)] opacity-80">Önceki: {formatNumber(data[hoverIndex].compareValue || 0, unit)}</p>}
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-bold text-[var(--chart-text-secondary)]">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </ChartShell>
  );
}

export function AnalyticsLineChart(props: Parameters<typeof AnalyticsAreaChart>[0]) {
  return <AnalyticsAreaChart {...props} />;
}

// compareData/compareColor/compareLabel are optional — when present, each
// category renders as TWO side-by-side bars (e.g. "Yeni Lead" vs
// "Kazanılan Müşteri" per month) sharing one y-scale, with a small legend.
// Every existing single-series caller is unaffected (props are optional,
// default behaviour unchanged).
export function AnalyticsBarChart({
  title, subtitle, data, color = "#0891b2", unit, height = 280, loading,
  compareData, compareColor = "#059669", label, compareLabel, theme = "dark", action
}: {
  title?: string; subtitle?: string; data: SeriesPoint[]; color?: string; unit?: string; height?: number; loading?: boolean;
  compareData?: SeriesPoint[]; compareColor?: string; label?: string; compareLabel?: string; theme?: ChartTheme; action?: React.ReactNode;
}) {
  const hasCompare = Boolean(compareData?.length);
  const max = Math.max(...data.map((d) => d.value), ...(compareData || []).map((d) => d.value), 1);
  return (
    <ChartShell title={title} subtitle={subtitle} height={height} empty={!data.length} loading={loading} theme={theme} action={action}>
      {hasCompare && (
        <div className="mb-2 flex items-center gap-4 text-xs font-bold text-[var(--chart-text-secondary)]">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label || "Seri 1"}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: compareColor }} />{compareLabel || "Seri 2"}</span>
        </div>
      )}
      <div className="flex h-full items-end gap-2" style={{ height: height - (hasCompare ? 68 : 48) }}>
        {data.map((d, i) => (
          <div key={i} className="group flex flex-1 flex-col items-center gap-2">
            <div className="relative flex w-full flex-1 items-end justify-center gap-1">
              <div className="w-full max-w-[42px] rounded-t-[8px] transition-all" style={{ height: `${Math.max(3, (d.value / max) * 100)}%`, background: color, opacity: 0.9 }} />
              {hasCompare && <div className="w-full max-w-[42px] rounded-t-[8px] transition-all" style={{ height: `${Math.max(3, ((compareData?.[i]?.value || 0) / max) * 100)}%`, background: compareColor, opacity: 0.9 }} />}
              <div className="pointer-events-none absolute -top-8 hidden rounded-[8px] px-2 py-1 text-[11px] font-bold text-[var(--chart-tooltip-text)] group-hover:block" style={{ background: "var(--chart-tooltip-bg)" }}>
                {hasCompare ? `${formatNumber(d.value, unit)} / ${formatNumber(compareData?.[i]?.value || 0, unit)}` : formatNumber(d.value, unit)}
              </div>
            </div>
            <span className="max-w-[70px] truncate text-[11px] font-bold text-[var(--chart-text-secondary)]">{d.label}</span>
          </div>
        ))}
      </div>
    </ChartShell>
  );
}

export function AnalyticsDonutChart({
  title, subtitle, data, height = 280, loading, theme = "dark", action, centerLabel
}: { title?: string; subtitle?: string; data: Array<{ label: string; value: number; color: string }>; height?: number; loading?: boolean; theme?: ChartTheme; action?: React.ReactNode; centerLabel?: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  // Precomputed (not mutated inside the render map callback) — each
  // segment's cumulative-value-so-far, derived purely from `data`.
  const cumulativeBefore: number[] = [];
  data.reduce((sum, d, i) => { cumulativeBefore[i] = sum; return sum + d.value; }, 0);
  return (
    <ChartShell title={title} subtitle={subtitle} height={height} empty={!total} loading={loading} theme={theme} action={action}>
      <div className="flex items-center gap-6">
        <div className="relative shrink-0">
          <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90" role="img" aria-label={title || "dağılım grafiği"}>
            <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--chart-grid)" strokeWidth="14" />
            {data.map((d, i) => {
              const fraction = total ? d.value / total : 0;
              const dash = fraction * circumference;
              const offset = -((cumulativeBefore[i] / total) * circumference || 0);
              return <circle key={i} cx="50" cy="50" r={radius} fill="none" stroke={d.color} strokeWidth="14" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={offset} />;
            })}
          </svg>
          {total > 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <span>
                <span className="block text-lg font-black text-[var(--chart-text)]">{total.toLocaleString("tr-TR")}</span>
                {centerLabel && <span className="block text-[9px] font-bold uppercase tracking-wide text-[var(--chart-text-muted)]">{centerLabel}</span>}
              </span>
            </div>
          )}
        </div>
        <div className="grid gap-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-bold text-[var(--chart-text-secondary)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              <span className="text-[var(--chart-text-secondary)]">{d.label}</span>
              <span className="text-[var(--chart-text-muted)]">{total ? `%${Math.round((d.value / total) * 100)}` : "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </ChartShell>
  );
}

// Small inline sparkline used inside MetricCard — deliberately tiny/no
// axes/no tooltip (the card itself carries the number); a real chart, never
// decorative-only random data.
export function MetricTrendSparkline({ data, color = "#0891b2" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i * 100) / (data.length - 1)},${28 - ((v - min) / range) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full" aria-hidden="true">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

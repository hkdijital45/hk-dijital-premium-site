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

function ChartShell({ title, subtitle, height = 280, empty, loading, children }: { title?: string; subtitle?: string; height?: number; empty?: boolean; loading?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] bg-white p-5 dark:bg-slate-900" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 12px 32px rgba(15,23,42,.05)" }}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <h3 className="text-base font-black" style={{ color: "var(--admin-text-primary)" }}>{title}</h3>}
          {subtitle && <p className="mt-0.5 text-xs" style={{ color: "var(--admin-text-muted)" }}>{subtitle}</p>}
        </div>
      )}
      {loading ? (
        <div className="grid place-items-center" style={{ height }}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
        </div>
      ) : empty ? (
        <div className="grid place-items-center text-center" style={{ height }}>
          <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>Seçili dönemde veri bulunamadı.</p>
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
  title, subtitle, data, color = "#0891b2", unit, height = 280, loading
}: { title?: string; subtitle?: string; data: SeriesPoint[]; color?: string; unit?: string; height?: number; loading?: boolean }) {
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
    <ChartShell title={title} subtitle={subtitle} height={height} empty={!data.length} loading={loading}>
      <div className="flex items-center gap-4 text-xs font-bold" style={{ color: "var(--admin-text-muted)" }}>
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
          <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="rgba(15,23,42,.08)" strokeWidth="0.5" />
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
          <div className="pointer-events-none absolute top-0 rounded-[10px] px-3 py-2 text-xs font-bold text-white shadow-lg" style={{ left: `${xFor(hoverIndex)}%`, transform: "translateX(-50%)", background: "rgba(15,23,42,.92)" }}>
            <p className="text-[10px] font-black uppercase tracking-wide opacity-70">{data[hoverIndex].label}</p>
            <p>{formatNumber(data[hoverIndex].value, unit)}</p>
            {hasCompare && <p className="opacity-70">Önceki: {formatNumber(data[hoverIndex].compareValue || 0, unit)}</p>}
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11px] font-bold" style={{ color: "var(--admin-text-muted)" }}>
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </ChartShell>
  );
}

export function AnalyticsLineChart(props: Parameters<typeof AnalyticsAreaChart>[0]) {
  return <AnalyticsAreaChart {...props} />;
}

export function AnalyticsBarChart({
  title, subtitle, data, color = "#0891b2", unit, height = 280, loading
}: { title?: string; subtitle?: string; data: SeriesPoint[]; color?: string; unit?: string; height?: number; loading?: boolean }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ChartShell title={title} subtitle={subtitle} height={height} empty={!data.length} loading={loading}>
      <div className="flex h-full items-end gap-2" style={{ height: height - 48 }}>
        {data.map((d, i) => (
          <div key={i} className="group flex flex-1 flex-col items-center gap-2">
            <div className="relative flex w-full flex-1 items-end justify-center">
              <div className="w-full max-w-[42px] rounded-t-[8px] transition-all" style={{ height: `${Math.max(3, (d.value / max) * 100)}%`, background: color, opacity: 0.85 }} />
              <div className="pointer-events-none absolute -top-8 hidden rounded-[8px] bg-slate-900 px-2 py-1 text-[11px] font-bold text-white group-hover:block">{formatNumber(d.value, unit)}</div>
            </div>
            <span className="max-w-[70px] truncate text-[11px] font-bold" style={{ color: "var(--admin-text-muted)" }}>{d.label}</span>
          </div>
        ))}
      </div>
    </ChartShell>
  );
}

export function AnalyticsDonutChart({
  title, subtitle, data, height = 280, loading
}: { title?: string; subtitle?: string; data: Array<{ label: string; value: number; color: string }>; height?: number; loading?: boolean }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  // Precomputed (not mutated inside the render map callback) — each
  // segment's cumulative-value-so-far, derived purely from `data`.
  const cumulativeBefore: number[] = [];
  data.reduce((sum, d, i) => { cumulativeBefore[i] = sum; return sum + d.value; }, 0);
  return (
    <ChartShell title={title} subtitle={subtitle} height={height} empty={!total} loading={loading}>
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 100 100" className="h-40 w-40 shrink-0 -rotate-90" role="img" aria-label={title || "dağılım grafiği"}>
          <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(15,23,42,.06)" strokeWidth="14" />
          {data.map((d, i) => {
            const fraction = total ? d.value / total : 0;
            const dash = fraction * circumference;
            const offset = -((cumulativeBefore[i] / total) * circumference || 0);
            return <circle key={i} cx="50" cy="50" r={radius} fill="none" stroke={d.color} strokeWidth="14" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={offset} />;
          })}
        </svg>
        <div className="grid gap-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
              <span>{d.label}</span>
              <span style={{ color: "var(--admin-text-muted)" }}>{total ? `%${Math.round((d.value / total) * 100)}` : "—"}</span>
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

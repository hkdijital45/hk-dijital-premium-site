export function CustomerMetricBox({
  label,
  value,
  explanation,
  comparisonLabel,
  comparisonTone = "neutral"
}: {
  label: string;
  value: any;
  explanation: string;
  comparisonLabel?: string;
  comparisonTone?: "positive" | "negative" | "neutral";
}) {
  const badgeClass = comparisonTone === "positive"
    ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
    : comparisonTone === "negative"
      ? "border-rose-300/30 bg-rose-400/15 text-rose-100"
      : "border-white/10 bg-white/[0.06] text-slate-200";
  return (
    <div className="rounded-[8px] border border-white/10 bg-white/[0.05] p-3 shadow-[0_20px_60px_rgba(15,23,42,.22)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold text-slate-300">{label}</p>
        {comparisonLabel && <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${badgeClass}`}>{comparisonLabel}</span>}
      </div>
      <p className="mt-2 text-xl font-black text-white">{String(value || 0)}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{explanation}</p>
    </div>
  );
}

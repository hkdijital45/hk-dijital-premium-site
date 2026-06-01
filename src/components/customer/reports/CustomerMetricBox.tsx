export function CustomerMetricBox({ label, value, explanation }: { label: string; value: any; explanation: string }) {
  return <div className="rounded-[8px] bg-white/[0.04] p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-white">{String(value || 0)}</p><p className="mt-2 text-xs leading-5 text-slate-500">{explanation}</p></div>;
}

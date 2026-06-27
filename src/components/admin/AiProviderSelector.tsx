"use client";

import { useEffect, useState } from "react";
import { unifiedAiProviderOptions, type UnifiedAiProviderKey } from "@/lib/ai-provider-options";

type ProviderStatus = {
  key: UnifiedAiProviderKey;
  status?: string;
  missingEnv?: string[];
  maskedKey?: string;
};

export function AiProviderSelector({
  value,
  onChange,
  compact = false,
  recommendedKeys = ["auto"],
  orderedKeys
}: {
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
  recommendedKeys?: string[];
  orderedKeys?: string[];
}) {
  const [statuses, setStatuses] = useState<Record<string, ProviderStatus>>({});

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/ai-providers")
      .then((response) => response.json())
      .then((data) => {
        if (!alive) return;
        const next = Object.fromEntries((data.providers || []).map((item: ProviderStatus) => [item.key, item]));
        setStatuses(next);
      })
      .catch(() => setStatuses({}));
    return () => {
      alive = false;
    };
  }, []);

  const options = orderedKeys?.length
    ? [...unifiedAiProviderOptions].sort((a, b) => {
      const aIndex = orderedKeys.indexOf(a.key);
      const bIndex = orderedKeys.indexOf(b.key);
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    })
    : unifiedAiProviderOptions;

  if (compact) {
    return <select value={value || "auto"} onChange={(event) => onChange(event.target.value)} className="rounded-[12px] border border-slate-200 px-3 py-3 text-sm">
      {options.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
    </select>;
  }

  return <div className="grid gap-2">
    {options.map((item) => {
      const status = statuses[item.key];
      const selected = (value || "auto") === item.key;
      const isRecommended = recommendedKeys.includes(item.key) || item.badge === "Önerilen";
      return <button
        key={item.key}
        type="button"
        onClick={() => onChange(item.key)}
        className={`rounded-[12px] border p-4 text-left transition ${selected ? "border-cyan-300 bg-cyan-50 text-slate-950 shadow-[0_12px_30px_rgba(14,165,233,.12)]" : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/50"}`}
      >
        <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-black">
          {item.label}
          <span className="flex items-center gap-2">
            {isRecommended && <span className="rounded-full bg-amber-300 px-2 py-1 text-[10px] font-black text-slate-950">Önerilen</span>}
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${status?.status === "Aktif" || item.key === "auto" || item.key === "demo" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{status?.status || (item.key === "auto" ? "Otomatik" : item.key === "demo" ? "Demo" : "Test edilmedi")}</span>
          </span>
        </span>
        <span className="mt-2 block text-xs leading-5 text-slate-600">{item.description}</span>
        {!!status?.missingEnv?.length && <span className="mt-2 block text-[11px] font-bold text-amber-700">Eksik env: {status.missingEnv.join(", ")}</span>}
      </button>;
    })}
  </div>;
}

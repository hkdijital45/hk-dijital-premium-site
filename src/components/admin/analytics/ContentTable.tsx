"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { PROVIDER_LABELS } from "@/lib/analytics-center/capabilities";
import type { AnalyticsProvider } from "@/lib/analytics-center/types";

export type ContentRow = {
  id: string;
  provider: AnalyticsProvider;
  content_type: string | null;
  title: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  metrics: Record<string, number | null>;
};

const METRIC_COLUMNS: Array<{ key: string; label: string }> = [
  { key: "views", label: "Görüntülenme" },
  { key: "reach", label: "Erişim" },
  { key: "likes", label: "Beğeni" },
  { key: "comments", label: "Yorum" },
  { key: "shares", label: "Paylaşım" },
  { key: "saves", label: "Kaydetme" }
];

function metricCell(row: ContentRow, key: string) {
  const value = row.metrics?.[key];
  if (value === undefined) return <span style={{ color: "var(--admin-text-muted)" }}>—</span>;
  if (value === null) return <span className="text-[11px] font-bold" style={{ color: "var(--admin-text-muted)" }}>API tarafından sunulmuyor</span>;
  return <span className="font-bold" style={{ color: "var(--admin-text-primary)" }}>{value.toLocaleString("tr-TR")}</span>;
}

// Premium, sortable, cross-platform content performance table (section 15) —
// columns adapt to which metrics the rows actually carry (never showing a
// fake 0 for a metric a platform doesn't expose; metrics-store only ever
// stores a value when a real API call returned one).
export function ContentTable({ rows, showPlatformColumn = true, emptyMessage = "Seçili dönemde içerik bulunamadı." }: { rows: ContentRow[]; showPlatformColumn?: boolean; emptyMessage?: string }) {
  const [sortKey, setSortKey] = useState<string>("published_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const availableMetricColumns = useMemo(() => METRIC_COLUMNS.filter((col) => rows.some((row) => row.metrics?.[col.key] !== undefined)), [rows]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const aValue = sortKey === "published_at" ? a.published_at || "" : a.metrics?.[sortKey] ?? -Infinity;
      const bValue = sortKey === "published_at" ? b.published_at || "" : b.metrics?.[sortKey] ?? -Infinity;
      const cmp = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  if (!rows.length) {
    return (
      <div className="grid place-items-center rounded-[18px] bg-white p-10 text-center dark:bg-slate-900">
        <p className="text-sm font-bold" style={{ color: "var(--admin-text-muted)" }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[18px] bg-white dark:bg-slate-900" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04), 0 12px 32px rgba(15,23,42,.05)" }}>
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="text-[11px] font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>
            <th className="p-4">İçerik</th>
            {showPlatformColumn && <th className="p-4">Platform</th>}
            <th className="p-4">Tür</th>
            <th className="cursor-pointer p-4" onClick={() => toggleSort("published_at")}>Tarih {sortKey === "published_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
            {availableMetricColumns.map((col) => (
              <th key={col.key} className="cursor-pointer p-4" onClick={() => toggleSort(col.key)}>{col.label} {sortKey === col.key ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
            ))}
            <th className="p-4" />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.id} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
              <td className="p-4">
                <div className="flex items-center gap-3">
                  {row.thumbnail_url ? (
                    <img src={row.thumbnail_url} alt="" className="h-12 w-12 shrink-0 rounded-[10px] object-cover" />
                  ) : (
                    <div className="h-12 w-12 shrink-0 rounded-[10px]" style={{ background: "var(--admin-surface-soft)" }} />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold" style={{ color: "var(--admin-text-primary)", maxWidth: 260 }}>{row.title || row.caption?.slice(0, 60) || "İçerik"}</p>
                  </div>
                </div>
              </td>
              {showPlatformColumn && <td className="p-4 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>{PROVIDER_LABELS[row.provider]}</td>}
              <td className="p-4 text-xs font-bold" style={{ color: "var(--admin-text-secondary)" }}>{row.content_type || "-"}</td>
              <td className="p-4 text-xs" style={{ color: "var(--admin-text-muted)" }}>{row.published_at ? new Date(row.published_at).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : "-"}</td>
              {availableMetricColumns.map((col) => <td key={col.key} className="p-4 text-sm">{metricCell(row, col.key)}</td>)}
              <td className="p-4">{row.permalink && <a href={row.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-black" style={{ color: "var(--admin-accent, #0891b2)" }}><ExternalLink size={13} /> Aç</a>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

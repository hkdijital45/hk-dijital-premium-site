"use client";

import type { ReactNode } from "react";
import { Star } from "lucide-react";

export type AdminModuleStatus = "live" | "attention" | "empty";

const STATUS_LABEL: Record<AdminModuleStatus, string> = {
  live: "Aktif",
  attention: "Dikkat gerekiyor",
  empty: "Henüz veri yok"
};

const STATUS_DOT: Record<AdminModuleStatus, string> = {
  live: "bg-emerald-500",
  attention: "bg-amber-500",
  empty: "bg-slate-400"
};

export function AdminModuleCard({
  icon,
  title,
  description,
  status = "live",
  kpiLabel,
  kpiValue,
  favorited = false,
  onOpen,
  onToggleFavorite,
  accent = "from-cyan-400 via-sky-500 to-blue-600"
}: {
  icon: ReactNode;
  title: string;
  description: string;
  status?: AdminModuleStatus;
  kpiLabel?: string;
  kpiValue?: ReactNode;
  favorited?: boolean;
  onOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onToggleFavorite?: () => void;
  accent?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(event as unknown as React.MouseEvent<HTMLElement>);
        }
      }}
      className="admin-card group relative flex min-w-0 cursor-pointer flex-col gap-4 rounded-[var(--admin-radius-card,22px)] p-5 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ boxShadow: "var(--admin-shadow-card, var(--admin-shadow))" }}
    >
      {onToggleFavorite && (
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onToggleFavorite(); }}
          aria-label={favorited ? `${title} favorilerden çıkar` : `${title} favorilere ekle`}
          aria-pressed={favorited}
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: favorited ? "#f59e0b" : "var(--admin-text-muted)" }}
        >
          <Star size={16} fill={favorited ? "currentColor" : "none"} />
        </button>
      )}
      <span className={`grid size-11 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br ${accent} text-white transition group-hover:brightness-110`}>{icon}</span>
      <div className="min-w-0">
        <h3 className="truncate text-base font-black" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>{title}</h3>
        <p className="mt-1 text-xs leading-5" style={{ color: "var(--admin-text-secondary)" }}>{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "var(--admin-text-muted)" }}>
          <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
          {STATUS_LABEL[status]}
        </span>
        {kpiValue !== undefined && (
          <span className="text-xs font-black" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>
            {kpiValue}{kpiLabel ? <span className="ml-1 font-semibold" style={{ color: "var(--admin-text-muted)" }}>{kpiLabel}</span> : null}
          </span>
        )}
      </div>
      <span className="hk-button hk-button-primary hk-button-compact mt-1 w-full justify-center">
        Aç
      </span>
    </div>
  );
}

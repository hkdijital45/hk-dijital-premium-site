"use client";

import type { DashboardQuickAction, NavigateFn } from "./types";

export function DashboardQuickActions({ actions, onNavigate }: { actions: DashboardQuickAction[]; onNavigate: NavigateFn }) {
  if (!actions.length) return null;
  return (
    <section className="flex flex-wrap gap-2.5">
      {actions.map((item) => (
        <button
          type="button"
          key={item.label}
          onClick={() => onNavigate(item.target)}
          className="admin-card group inline-flex min-h-12 items-center gap-3 rounded-[16px] px-3.5 py-2 text-left text-sm font-black transition hover:-translate-y-0.5"
          style={{ color: "var(--admin-text-primary)" }}
        >
          <span className={`grid size-9 shrink-0 place-items-center rounded-[12px] bg-gradient-to-br ${item.gradient} text-slate-900 shadow-[0_8px_18px_rgba(37,99,235,.14)]`}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </section>
  );
}

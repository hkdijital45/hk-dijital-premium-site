"use client";

import type { DashboardCategoryCard, NavigateFn } from "./types";

export function DashboardFavoriteModules({ cards, onNavigate }: { cards: DashboardCategoryCard[]; onNavigate: NavigateFn }) {
  if (!cards.length) return null;
  return (
    <section aria-labelledby="favorite-modules-title">
      <div className="mb-3">
        <h2 id="favorite-modules-title" className="text-xl font-black" style={{ color: "var(--admin-text-primary)" }}>Modül Kısayolları</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>En sık kullanılan operasyon alanlarına hızlı erişim.</p>
      </div>
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="admin-card overflow-hidden rounded-[22px] p-5">
            <div className={`grid size-11 place-items-center rounded-[14px] bg-gradient-to-br ${card.gradient} text-white`}>{card.icon}</div>
            <h3 className="mt-4 text-base font-black" style={{ color: "var(--admin-text-primary)" }}>{card.title}</h3>
            <p className="mt-1 text-sm leading-6" style={{ color: "var(--admin-text-secondary)" }}>{card.description}</p>
            <p className="mt-2 text-xs font-black uppercase tracking-[.1em]" style={{ color: "var(--admin-text-muted)" }}>{card.count}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {card.actions.map(([label, target]) => (
                <button type="button" key={label} onClick={() => onNavigate(target)} className="hk-button hk-button-compact hk-button-neutral">{label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

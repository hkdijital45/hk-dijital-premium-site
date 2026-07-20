"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AdminModuleCard, type AdminModuleStatus } from "@/components/admin/ui/AdminModuleCard";
import { AdminCenterPopover, type AdminCenterPopoverAction, type AdminCenterPopoverItem } from "@/components/admin/ui/AdminCenterPopover";

export type DashboardCenterCard = {
  key: string;
  title: string;
  description: string;
  icon: ReactNode;
  accent: string;
  kpiLabel: string;
  kpiValue: number;
  target: string;
  items: AdminCenterPopoverItem[];
  quickActions: AdminCenterPopoverAction[];
};

const FAVORITES_KEY = "hk-admin-center-favorites";

function statusFor(value: number): AdminModuleStatus {
  return value > 0 ? "live" : "empty";
}

export function DashboardCenterGrid({ cards }: { cards: DashboardCenterCard[] }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Reads localStorage after mount (not in the initializer) so the first
  // client render matches the server-rendered HTML and avoids a hydration
  // mismatch; the resulting one-time setState is intentional here.
  useEffect(() => {
    let stored: string[] = [];
    try {
      stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    } catch {
      stored = [];
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(stored);
  }, []);

  function toggleFavorite(key: string) {
    setFavorites((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        /* localStorage unavailable — favorite just won't persist across reloads */
      }
      return next;
    });
  }

  const closePopover = useCallback(() => setOpenKey(null), []);

  if (!cards.length) return null;

  const openCard = cards.find((card) => card.key === openKey) || null;

  return (
    <section aria-labelledby="admin-center-grid-title">
      <div className="mb-3">
        <h2 id="admin-center-grid-title" className="text-xl font-black" style={{ color: "var(--admin-text, var(--admin-text-primary))" }}>Merkezler</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--admin-text-secondary)" }}>Ajansınızın tüm süreçleri tek platformda. Bir merkezi açmak için kartına tıklayın.</p>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <AdminModuleCard
            key={card.key}
            icon={card.icon}
            title={card.title}
            description={card.description}
            accent={card.accent}
            status={statusFor(card.kpiValue)}
            kpiLabel={card.kpiLabel}
            kpiValue={card.kpiValue}
            favorited={favorites.includes(card.key)}
            onToggleFavorite={() => toggleFavorite(card.key)}
            onOpen={(event) => {
              setAnchorRect(event.currentTarget.getBoundingClientRect());
              setOpenKey(card.key);
            }}
          />
        ))}
      </div>
      <AdminCenterPopover
        open={Boolean(openCard)}
        anchorRect={anchorRect}
        onClose={closePopover}
        title={openCard?.title || ""}
        description={openCard?.description || ""}
        items={openCard?.items || []}
        quickActions={openCard?.quickActions || []}
      />
    </section>
  );
}

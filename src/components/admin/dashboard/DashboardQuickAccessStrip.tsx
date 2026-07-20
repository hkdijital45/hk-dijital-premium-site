"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { getFavoriteSubItems, type AdminQuickAccessItem } from "@/lib/admin-quick-access";

export function DashboardQuickAccessStrip() {
  const [favorites, setFavorites] = useState<AdminQuickAccessItem[]>([]);

  // Reads localStorage after mount so the first client render matches the
  // server-rendered HTML (no favorites yet known server-side).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFavorites(getFavoriteSubItems());
  }, []);

  if (!favorites.length) return null;

  return (
    <section aria-label="Hızlı Erişim" className="mb-1">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-black uppercase tracking-wide" style={{ color: "var(--admin-text-muted)" }}>
        <Star size={13} fill="currentColor" style={{ color: "#f59e0b" }} /> Hızlı Erişim
      </div>
      <div className="flex flex-wrap gap-2">
        {favorites.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full px-3 py-1.5 text-xs font-bold transition hover:-translate-y-0.5"
            style={{ background: "var(--admin-surface-muted, var(--admin-surface-soft))", color: "var(--admin-text-secondary)" }}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

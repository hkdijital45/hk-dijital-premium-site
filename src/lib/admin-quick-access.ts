"use client";

// Lightweight, client-only "favorite sub-module" + "recently opened sub-module"
// tracking for the admin center popovers. Stored per-browser in localStorage —
// no backend/schema change, safe to ship without a migration.

export type AdminQuickAccessItem = {
  href: string;
  label: string;
  centerTitle: string;
};

const FAVORITES_KEY = "hk-admin-subitem-favorites";
const RECENTS_KEY = "hk-admin-subitem-recent";
const RECENTS_LIMIT = 8;

function readList(key: string): AdminQuickAccessItem[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(key: string, items: AdminQuickAccessItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    /* localStorage unavailable — quick access just won't persist */
  }
}

export function getFavoriteSubItems(): AdminQuickAccessItem[] {
  return readList(FAVORITES_KEY);
}

export function isFavoriteSubItem(href: string): boolean {
  return getFavoriteSubItems().some((item) => item.href === href);
}

export function toggleFavoriteSubItem(item: AdminQuickAccessItem): AdminQuickAccessItem[] {
  const current = getFavoriteSubItems();
  const next = current.some((entry) => entry.href === item.href)
    ? current.filter((entry) => entry.href !== item.href)
    : [item, ...current].slice(0, 24);
  writeList(FAVORITES_KEY, next);
  return next;
}

export function getRecentSubItems(): AdminQuickAccessItem[] {
  return readList(RECENTS_KEY);
}

export function pushRecentSubItem(item: AdminQuickAccessItem): AdminQuickAccessItem[] {
  const next = [item, ...getRecentSubItems().filter((entry) => entry.href !== item.href)].slice(0, RECENTS_LIMIT);
  writeList(RECENTS_KEY, next);
  return next;
}

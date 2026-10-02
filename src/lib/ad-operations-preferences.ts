"use client";

// Reklam Operasyon Merkezi auto-sync on/off preference. No new DB
// table/migration — same localStorage pattern already used by
// admin-quick-access.ts (favorites/recents): SSR-safe window guard,
// try/catch, safe fallback. Default is ON; any missing/invalid stored
// value fails safe to ON (never silently disables a user-visible
// freshness check the user never explicitly turned off).
const AUTO_SYNC_PREF_KEY = "hk-admin-ad-operations-auto-sync";

export function getAutoSyncPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(AUTO_SYNC_PREF_KEY);
    return raw !== "off";
  } catch {
    return true;
  }
}

export function setAutoSyncPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTO_SYNC_PREF_KEY, enabled ? "on" : "off");
  } catch {
    /* localStorage unavailable — preference just won't persist this session */
  }
}

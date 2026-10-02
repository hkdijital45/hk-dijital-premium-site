// Pure, dependency-free sync-freshness/auto-sync decision logic (PART
// 10/11 of the Reklam Operasyon Merkezi auto-sync task). Extracted so
// the exact same rules are used by the GET action=sync-status route
// (src/app/api/admin/meta-ads/route.ts) and GrowthOperatingSystem.tsx's
// auto-sync effect, and so they are directly unit-testable the same way
// every other piece of logic in this repo is (no React/DOM test runner
// exists here — see tests/unit's convention of testing pure functions).

export const META_SYNC_FRESHNESS_MS = 5 * 60 * 1000;

export type SyncLogRow = { result: string; created_at: string };
export type SyncStatus = { lastSuccessfulAt: string | null; lastAttemptAt: string | null; lastAttemptFailed: boolean };

/** Derives sync-status facts from integration_sync_logs rows (already
 * ordered newest-first) — the SAME definition of "successful" used
 * everywhere: "Başarılı" or "Uyarı" both count (an unrelated warning,
 * e.g. the creative/Ad-Library fetch issue, does not mean the real
 * campaign/adset/ad data failed to save); only "Hata" is a failure. A
 * failed attempt is reported separately and never overwrites the last
 * successful timestamp — it is simply not a candidate for it. */
export function deriveSyncStatus(rows: SyncLogRow[]): SyncStatus {
  const lastAttempt = rows[0] || null;
  const lastSuccessful = rows.find((row) => row.result === "Başarılı" || row.result === "Uyarı") || null;
  return {
    lastSuccessfulAt: lastSuccessful?.created_at || null,
    lastAttemptAt: lastAttempt?.created_at || null,
    lastAttemptFailed: Boolean(lastAttempt && lastAttempt.result === "Hata")
  };
}

/** No successful sync ever recorded, or the last one is older than the
 * threshold, counts as stale. An unparseable timestamp is treated as
 * stale (fail safe toward syncing, never toward silently going stale
 * forever). */
export function isSyncStale(lastSuccessfulAt: string | null, now: number = Date.now(), thresholdMs: number = META_SYNC_FRESHNESS_MS): boolean {
  if (!lastSuccessfulAt) return true;
  const ts = new Date(lastSuccessfulAt).getTime();
  if (!Number.isFinite(ts)) return true;
  return now - ts > thresholdMs;
}

/** Pure gate for "should a NEW auto-sync attempt start right now" — at
 * most one attempt per customer+account key, never while one is already
 * in flight, and never for a key this module instance already attempted
 * (prevents a render-loop / repeated auto-sync even if the surrounding
 * effect re-fires for an unrelated reason while the same key is still
 * current). Manual "Senkronize Et" clicks never call this — they always
 * bypass the freshness threshold by design. */
export function shouldStartAutoSync(input: { isStale: boolean; currentlySyncing: boolean; key: string; lastAttemptedKey: string | null }): boolean {
  return input.isStale && !input.currentlySyncing && input.lastAttemptedKey !== input.key;
}

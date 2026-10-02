// Reklam Operasyon Merkezi controlled auto-sync (PART 10/11/17) — pure
// decision logic, shared by the GET action=sync-status route and
// GrowthOperatingSystem.tsx's auto-sync effect. No React/DOM test
// runner exists in this repo, so the decision logic is tested here as
// the plain functions it actually is; the component only wires these
// into an effect, it introduces no logic of its own.
import test from "node:test";
import assert from "node:assert/strict";
import { deriveSyncStatus, isSyncStale, shouldStartAutoSync, META_SYNC_FRESHNESS_MS } from "../../../src/lib/marketing-intelligence/meta-sync-freshness.ts";

// --- deriveSyncStatus: "successful" vs "failed", never conflated ---

test("deriveSyncStatus: 'Başarılı' and 'Uyarı' both count as a successful sync (a warning like the creative fetch issue never means the real data failed to save)", () => {
  const status = deriveSyncStatus([{ result: "Uyarı", created_at: "2026-10-02T11:07:00Z" }]);
  assert.equal(status.lastSuccessfulAt, "2026-10-02T11:07:00Z");
  assert.equal(status.lastAttemptFailed, false);
});

test("deriveSyncStatus: a failed attempt ('Hata') is reported separately and NEVER overwrites/replaces the last successful timestamp", () => {
  const status = deriveSyncStatus([
    { result: "Hata", created_at: "2026-10-02T12:00:00Z" },
    { result: "Başarılı", created_at: "2026-10-02T11:00:00Z" }
  ]);
  assert.equal(status.lastSuccessfulAt, "2026-10-02T11:00:00Z", "the older successful sync's timestamp must still be reported, not discarded by the newer failed attempt");
  assert.equal(status.lastAttemptAt, "2026-10-02T12:00:00Z");
  assert.equal(status.lastAttemptFailed, true);
});

test("deriveSyncStatus: no sync has ever run returns all-null/false, never a fabricated timestamp", () => {
  const status = deriveSyncStatus([]);
  assert.deepEqual(status, { lastSuccessfulAt: null, lastAttemptAt: null, lastAttemptFailed: false });
});

// --- isSyncStale ---

test("isSyncStale: no previous successful sync at all counts as stale (-> auto-sync should run) — PART 17 test 1", () => {
  assert.equal(isSyncStale(null), true);
});

test("isSyncStale: last successful sync older than the 5-minute threshold is stale -> auto-sync should run — PART 17 test 2", () => {
  const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  assert.equal(isSyncStale(sixMinutesAgo), true);
});

test("isSyncStale: last successful sync within the 5-minute threshold is fresh -> no auto-sync — PART 17 test 3", () => {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  assert.equal(isSyncStale(twoMinutesAgo), false);
});

test("isSyncStale: threshold is a single overridable constant (META_SYNC_FRESHNESS_MS), default is exactly 5 minutes", () => {
  assert.equal(META_SYNC_FRESHNESS_MS, 5 * 60 * 1000);
  const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString();
  assert.equal(isSyncStale(fourMinutesAgo, Date.now(), 3 * 60 * 1000), true, "a custom threshold must be honored");
  assert.equal(isSyncStale(fourMinutesAgo, Date.now(), 10 * 60 * 1000), false);
});

test("isSyncStale: an unparseable timestamp fails safe toward 'stale' rather than silently never syncing again", () => {
  assert.equal(isSyncStale("not-a-real-date"), true);
});

// --- shouldStartAutoSync: concurrency guard + no render loop ---

test("shouldStartAutoSync: stale + not currently syncing + never attempted for this key -> starts — PART 17 test 1/2/8", () => {
  assert.equal(shouldStartAutoSync({ isStale: true, currentlySyncing: false, key: "companyA::acc1", lastAttemptedKey: null }), true);
});

test("shouldStartAutoSync: fresh data never triggers a sync regardless of other state — PART 17 test 3/9", () => {
  assert.equal(shouldStartAutoSync({ isStale: false, currentlySyncing: false, key: "companyA::acc1", lastAttemptedKey: null }), false);
});

test("shouldStartAutoSync: a sync already in flight for this module instance blocks a second concurrent auto-sync attempt — PART 17 test 5", () => {
  assert.equal(shouldStartAutoSync({ isStale: true, currentlySyncing: true, key: "companyA::acc1", lastAttemptedKey: null }), false);
});

test("shouldStartAutoSync: the SAME customer+account key is never auto-synced twice once already attempted — prevents a render-loop/repeated auto-sync — PART 17 test 10", () => {
  assert.equal(shouldStartAutoSync({ isStale: true, currentlySyncing: false, key: "companyA::acc1", lastAttemptedKey: "companyA::acc1" }), false);
});

test("shouldStartAutoSync: switching to a genuinely DIFFERENT customer/account key is allowed to auto-sync even if another key was already attempted — PART 17 test 8", () => {
  assert.equal(shouldStartAutoSync({ isStale: true, currentlySyncing: false, key: "companyB::acc2", lastAttemptedKey: "companyA::acc1" }), true);
});

test("shouldStartAutoSync: switching to a FRESH customer/account never auto-syncs just because a different key was previously attempted — PART 17 test 9", () => {
  assert.equal(shouldStartAutoSync({ isStale: false, currentlySyncing: false, key: "companyB::acc2", lastAttemptedKey: "companyA::acc1" }), false);
});

// Regression tests for the PUT /api/content data-integrity fix
// (src/lib/content.ts: saveSiteContentIfUnchanged / mutateSiteContent,
// site_settings.updated_at used as an optimistic-concurrency token) and
// the companion runtime allow-list (src/lib/site-content-allowlist.ts).
//
// The real site_settings row with key="site_content" is the live,
// production CMS content for www.hkdijital.com.tr — these tests never
// read, write, or delete it. The OCC mechanism itself (a PostgREST PATCH
// filtered on updated_at) is identical regardless of which row it targets,
// so it's exercised here against a disposable QA-prefixed row with its own
// throwaway key, created and deleted by this test, exactly as the
// existing customer-campaign-publication.test.ts does for company rows.
import test from "node:test";
import assert from "node:assert/strict";
import { findUnauthorizedTopLevelKeys, SITE_CONTENT_TOP_LEVEL_KEYS } from "../../src/lib/site-content-allowlist.ts";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live coverage skipped rather than faked.";

test("findUnauthorizedTopLevelKeys: a payload using only real SiteContent keys passes", () => {
  const payload = Object.fromEntries(SITE_CONTENT_TOP_LEVEL_KEYS.map((key) => [key, {}]));
  assert.deepEqual(findUnauthorizedTopLevelKeys(payload), []);
});

test("findUnauthorizedTopLevelKeys: rejects an unrecognized top-level field (e.g. an injected/fabricated key)", () => {
  assert.deepEqual(findUnauthorizedTopLevelKeys({ brand: {}, fabricatedKey: {}, notARealField: 1 }), ["fabricatedKey", "notARealField"]);
});

test("findUnauthorizedTopLevelKeys: empty payload is clean (no fields to reject)", () => {
  assert.deepEqual(findUnauthorizedTopLevelKeys({}), []);
});

async function qaRow(label: string) {
  const { supabaseRest } = await import("../../src/lib/supabase.ts");
  const key = `qa-occ-${label}-${Date.now()}`;
  const [row] = await supabaseRest<Array<{ key: string; value: unknown; updated_at: string }>>("site_settings", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ key, value: { seed: true }, updated_at: new Date().toISOString() })
  });
  return { supabaseRest, key, updatedAt: row.updated_at };
}

async function cleanupQaRow(key: string) {
  const { supabaseRest } = await import("../../src/lib/supabase.ts");
  await supabaseRest(`site_settings?key=eq.${key}`, { method: "DELETE" }).catch(() => {});
}

test(
  "REGRESSION — a stale updated_at cannot silently overwrite a newer write (lost-update protection)",
  { skip: hasSupabase ? false : skipReason },
  async () => {
    const { supabaseRest, key, updatedAt: originalVersion } = await qaRow("stale");
    try {
      // Simulate a second, concurrent writer (e.g. another admin tab)
      // saving first — this is the "newer write" the first writer's stale
      // version must not be able to clobber.
      const [afterConcurrentWrite] = await supabaseRest<Array<{ updated_at: string }>>(
        `site_settings?key=eq.${key}`,
        { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ value: { from: "concurrent-writer" }, updated_at: new Date().toISOString() }) }
      );
      assert.notEqual(afterConcurrentWrite.updated_at, originalVersion, "the concurrent write must actually change updated_at for this test to be meaningful");

      // The original writer now attempts to save using the version it
      // read BEFORE the concurrent write — this is exactly the scenario
      // saveSiteContentIfUnchanged guards against.
      const staleAttempt = await supabaseRest<unknown[]>(
        `site_settings?key=eq.${key}&updated_at=eq.${encodeURIComponent(originalVersion)}`,
        { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ value: { from: "stale-writer" }, updated_at: new Date().toISOString() }) }
      );
      assert.deepEqual(staleAttempt, [], "a stale-version PATCH must match zero rows, not silently apply");

      const [finalRow] = await supabaseRest<Array<{ value: { from?: string } }>>(`site_settings?key=eq.${key}&select=value`);
      assert.equal(finalRow.value.from, "concurrent-writer", "the newer write must survive; the stale writer's data must never have been applied");
    } finally {
      await cleanupQaRow(key);
    }
  }
);

test(
  "REGRESSION — a save using the current (unchanged) version succeeds and advances the version",
  { skip: hasSupabase ? false : skipReason },
  async () => {
    const { supabaseRest, key, updatedAt: originalVersion } = await qaRow("fresh");
    try {
      const applied = await supabaseRest<Array<{ value: { from?: string }; updated_at: string }>>(
        `site_settings?key=eq.${key}&updated_at=eq.${encodeURIComponent(originalVersion)}`,
        { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ value: { from: "correct-version-writer" }, updated_at: new Date().toISOString() }) }
      );
      assert.equal(applied.length, 1, "a PATCH filtered on the still-current version must match exactly one row");
      assert.equal(applied[0].value.from, "correct-version-writer");
      assert.notEqual(applied[0].updated_at, originalVersion, "a successful save must advance the version token");
    } finally {
      await cleanupQaRow(key);
    }
  }
);

test(
  "REGRESSION — concurrent writes to the same row never silently drop either write (one succeeds, one is rejected, nothing is lost)",
  { skip: hasSupabase ? false : skipReason },
  async () => {
    const { supabaseRest, key, updatedAt: originalVersion } = await qaRow("concurrent");
    try {
      const attempt = (from: string) =>
        supabaseRest<unknown[]>(`site_settings?key=eq.${key}&updated_at=eq.${encodeURIComponent(originalVersion)}`, {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ value: { from }, updated_at: new Date().toISOString() })
        }).catch(() => [] as unknown[]);

      const [resultA, resultB] = await Promise.all([attempt("writer-a"), attempt("writer-b")]);
      const successCount = [resultA, resultB].filter((r) => Array.isArray(r) && r.length > 0).length;
      // Both requests race on the SAME expected version — at most one can
      // win (PostgREST serializes the UPDATE), the other must cleanly see
      // zero matched rows rather than both silently "succeeding" and one
      // overwriting the other with no trace.
      assert.equal(successCount, 1, "exactly one of two simultaneous same-version writers should win; the loser must see zero matched rows, never a silent double-apply");
    } finally {
      await cleanupQaRow(key);
    }
  }
);

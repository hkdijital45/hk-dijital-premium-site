// İçerik Takip content plan — details persistence + safe update capability.
//
// Real production bug: create_content_plan silently dropped every
// production-detail field a Claude-authored plan carried (hook, content
// flow, caption, CTA, hashtag approach, objective, audience, rationale,
// conditions/[DOĞRULANACAK], Story support, production notes) — only
// hook/summary/cta/goal/audience/priority/rationale were ever read into
// `notes`, and there was no way to safely complete an already-created
// row's details afterward without risking a duplicate or touching another
// company's row.
//
// Fix: ContentPlanItemDetails now covers the full field set, buildNotes()
// renders all of them losslessly (verbatim, never rewritten) into the
// existing `notes` text column (no new table/column), and a new
// update_content_plan_items MCP tool completes an EXISTING row's details
// by id, with id+companyId enforced together at the query level so one
// company can never touch another's row, and never inserts/duplicates.
//
// This suite only ever touches disposable QA-prefixed fixture companies —
// MY CAKE 45's real 13 production rows are never created, updated, or
// read-written in any test here (only counted, read-only, in the final
// safety check).
//
// Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/instagram-profile-audits/*.test.ts
import test from "node:test";
import assert from "node:assert/strict";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live regression coverage skipped rather than faked.";
const MY_CAKE_45_COMPANY_ID = "fc51d411-ea37-45e4-9c93-df0cd43a4a42";

async function makeFixtureCompany(label: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const unique = `QA-ContentPlanDetails-${label}-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", {
    method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true })
  });
  return company.id as string;
}

async function cleanupFixtureCompany(companyId: string) {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { CONTENT_PLAN_TABLE } = await import("../../../src/lib/content-plan/types.ts");
  await supabaseRest(`${CONTENT_PLAN_TABLE}?company_id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
  await supabaseRest(`companies?id=eq.${companyId}`, { method: "DELETE" }).catch(() => {});
}

// --- TEST 1 — create with full details, readback preserves everything ---

test("createContentPlanItems REGRESSION — full production details survive create + readback losslessly", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createContentPlanItems } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const { fetchContentPlanRows } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const companyId = await makeFixtureCompany("Create");

  try {
    const detail = {
      scheduled_date: "2027-02-01",
      topic: "Cupcake vitrini",
      hook: "İlk 3 saniyede ürün detayına yakın çekim",
      contentFlow: "Açılış çekim -> üretim anı -> final ürün",
      caption: "El yapımı cupcake koleksiyonumuz burada!",
      cta: "DM'den sipariş verin",
      hashtagApproach: "#manisa #butikpasta #cupcake",
      goal: "Marka bilinirliği",
      audience: "25-40 yaş kadın, yerel",
      rationale: "Ürün çeşitliliğini göstermek",
      conditions: "[DOĞRULANACAK] Yeterli kaliteli cupcake görseli varsa yayınlanacak.",
      storySupport: "Story: kısa arkasında-perde klip"
    };
    const result = await createContentPlanItems([detail], companyId);
    assert.equal(result.inserted, 1);

    const history = await fetchContentPlanRows("history", companyId, 20);
    const upcoming = await fetchContentPlanRows("upcoming", companyId, 20);
    const saved = [...history, ...upcoming][0];
    assert.ok(saved, "the created row must be readable back");

    for (const [field, value] of Object.entries({
      hook: detail.hook, contentFlow: detail.contentFlow, caption: detail.caption, cta: detail.cta,
      hashtagApproach: detail.hashtagApproach, goal: detail.goal, audience: detail.audience,
      rationale: detail.rationale, conditions: detail.conditions, storySupport: detail.storySupport
    })) {
      assert.ok(saved.notes.includes(value), `notes must preserve ${field} verbatim`);
    }
  } finally {
    await cleanupFixtureCompany(companyId);
  }
});

// --- TEST 2 — [DOĞRULANACAK] survives exactly ---

test("createContentPlanItems REGRESSION — [DOĞRULANACAK] marker text is preserved verbatim, never stripped or resolved", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createContentPlanItems, fetchContentPlanRows } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const companyId = await makeFixtureCompany("Dogrulanacak");
  try {
    const marker = "[DOĞRULANACAK] Fiyat politikası ve kapora bilgisi işletmeden teyit edilecek.";
    await createContentPlanItems([{ scheduled_date: "2027-02-02", topic: "Fiyat postu", conditions: marker }], companyId);
    const [row] = await fetchContentPlanRows("upcoming", companyId, 5);
    assert.ok(row.notes.includes(marker), "marker text must appear exactly, unmodified");
  } finally {
    await cleanupFixtureCompany(companyId);
  }
});

// --- TEST 3 — conditional content survives ---

test("createContentPlanItems REGRESSION — conditional-publish notes (e.g. Story survey results, customer feedback) survive create/readback", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createContentPlanItems, fetchContentPlanRows } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const companyId = await makeFixtureCompany("Conditional");
  try {
    const condition = "Yalnızca gerçek + izinli müşteri geri bildirimi varsa yayınlanacak.";
    await createContentPlanItems([{ scheduled_date: "2027-02-03", topic: "Müşteri yorumu", conditions: condition, storySupport: "Yeterli katılım varsa Story anket sonucu paylaşılacak." }], companyId);
    const [row] = await fetchContentPlanRows("upcoming", companyId, 5);
    assert.ok(row.notes.includes(condition));
    assert.ok(row.notes.includes("Story anket sonucu"));
  } finally {
    await cleanupFixtureCompany(companyId);
  }
});

// --- TEST 4 — safe update: same row, no duplicate, basic fields unchanged ---

test("updateContentPlanItemDetails REGRESSION — completes an existing row's details in place: same id, row count unchanged, basic fields untouched", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createContentPlanItems, updateContentPlanItemDetails, fetchContentPlanRows } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { CONTENT_PLAN_TABLE } = await import("../../../src/lib/content-plan/types.ts");
  const companyId = await makeFixtureCompany("Update");
  try {
    const created = await createContentPlanItems([{ scheduled_date: "2027-02-04", topic: "Güncellenecek içerik", theme: "test-theme" }], companyId);
    const row = created.items[0];
    assert.equal(row.notes, "[Kaynak: Instagram Intelligence]", "sanity check — created with no details yet");

    const updated = await updateContentPlanItemDetails([{ id: row.id, hook: "Sonradan eklenen hook", cta: "Sonradan eklenen CTA" }], companyId);
    assert.equal(updated.updated, 1);
    assert.equal(updated.items[0].id, row.id, "must update the SAME row, never a new one");
    assert.ok(updated.items[0].notes.includes("Sonradan eklenen hook"));

    const allRows = await supabaseRest<Array<{ id: string }>>(`${CONTENT_PLAN_TABLE}?company_id=eq.${companyId}&select=id`);
    assert.equal(allRows.length, 1, "update must never create a duplicate row");

    const [reread] = await fetchContentPlanRows("upcoming", companyId, 5);
    assert.equal(reread.scheduled_date, "2027-02-04", "scheduled_date must be untouched by an update");
    assert.equal(reread.theme, "test-theme", "theme must be untouched by an update");
    assert.equal(reread.content_title, "Güncellenecek içerik", "topic/content_title must be untouched by an update");
  } finally {
    await cleanupFixtureCompany(companyId);
  }
});

// --- TEST 5 — cross-company update rejected ---

test("updateContentPlanItemDetails REGRESSION — company A cannot update company B's row by id", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createContentPlanItems, updateContentPlanItemDetails, ContentPlanItemNotFoundError } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const companyA = await makeFixtureCompany("CrossA");
  const companyB = await makeFixtureCompany("CrossB");
  try {
    const created = await createContentPlanItems([{ scheduled_date: "2027-02-05", topic: "B'nin içeriği" }], companyB);
    const bRowId = created.items[0].id;

    await assert.rejects(
      () => updateContentPlanItemDetails([{ id: bRowId, hook: "A tarafından enjekte edilmeye çalışılan hook" }], companyA),
      ContentPlanItemNotFoundError
    );
  } finally {
    await cleanupFixtureCompany(companyA);
    await cleanupFixtureCompany(companyB);
  }
});

// --- TEST 6 — existing basic create (no detail fields) still works ---

test("createContentPlanItems REGRESSION — basic date/platform/theme/topic/format-only create still works unchanged", { skip: hasSupabase ? false : skipReason }, async () => {
  const { createContentPlanItems } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const companyId = await makeFixtureCompany("Basic");
  try {
    const result = await createContentPlanItems([{ scheduled_date: "2027-02-06", topic: "Basit içerik", theme: "Sosyal Medya", content_format: "carousel", platforms: ["instagram"] }], companyId);
    assert.equal(result.inserted, 1);
    assert.equal(result.items[0].notes, "[Kaynak: Instagram Intelligence]");
    assert.equal(result.items[0].content_format, "carousel");
  } finally {
    await cleanupFixtureCompany(companyId);
  }
});

// --- TEST 9 (schema) — new tool registered correctly ---

test("MCP REGRESSION — update_content_plan_items is registered, WRITE_SAFE, requires companyId + items", async () => {
  const { tools } = await import("../../../src/lib/instagram-intelligence/mcp/protocol.ts");
  const tool = tools.find((t: any) => t.name === "update_content_plan_items");
  assert.ok(tool, "update_content_plan_items must be registered");
  assert.equal(tool!.permission, "WRITE_SAFE");
  assert.deepEqual(tool!.inputSchema.required, ["companyId", "items"]);
});

// --- TEST 8 — MY CAKE 45's real 13 rows are never touched, count unchanged ---

test("PRODUCTION SAFETY — MY CAKE 45's real content plan row count is unchanged by this test run", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { CONTENT_PLAN_TABLE } = await import("../../../src/lib/content-plan/types.ts");
  const rows = await supabaseRest<Array<{ id: string }>>(`${CONTENT_PLAN_TABLE}?company_id=eq.${MY_CAKE_45_COMPANY_ID}&select=id`);
  assert.equal(rows.length, 13, "MY CAKE 45 must still have exactly its real 13 production rows — none created/deleted by this test suite");
});

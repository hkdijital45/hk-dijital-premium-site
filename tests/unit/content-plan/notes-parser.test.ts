// parseContentPlanNotes() — read-only parser for the deterministic
// labeled-line `notes` format buildNotes() (instagram-intelligence/
// plan.ts) writes. Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/content-plan/*.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { parseContentPlanNotes, hasContentPlanDetails } from "../../../src/lib/content-plan/notes-parser.ts";

const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const skipReason = "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not available in this environment — live round-trip coverage skipped rather than faked.";

test("parseContentPlanNotes: legacy source-only notes never crash and carry no fabricated detail fields", () => {
  const parsed = parseContentPlanNotes("[Kaynak: Instagram Intelligence]");
  assert.equal(parsed.source, "Instagram Intelligence");
  for (const key of ["hook", "contentFlow", "caption", "cta", "hashtagApproach", "goal", "audience", "priority", "rationale", "conditions", "storySupport", "productionNotes", "unrecognized"] as const) {
    assert.equal(parsed[key], null, `${key} must stay null for a legacy source-only note`);
  }
});

test("parseContentPlanNotes: empty/undefined/non-string input never throws", () => {
  assert.doesNotThrow(() => parseContentPlanNotes(""));
  assert.doesNotThrow(() => parseContentPlanNotes(undefined));
  assert.doesNotThrow(() => parseContentPlanNotes(null));
  assert.doesNotThrow(() => parseContentPlanNotes(42));
  assert.equal(hasContentPlanDetails(parseContentPlanNotes("")), false);
});

test("parseContentPlanNotes: multiline caption/contentFlow, Turkish characters, and [DOĞRULANACAK] all survive", () => {
  const notes = [
    "[Kaynak: Instagram Intelligence]",
    "Hook: İlk 3 saniyede ürün detayına yakın çekim",
    "İçerik Akışı: Açılış çekim -> üretim anı",
    "-> final ürün gösterimi",
    "Caption: El yapımı çeşit çeşit cupcake koleksiyonumuz burada!",
    "İkinci satır caption devamı.",
    "CTA: DM'den sipariş verin",
    "Hashtag Yaklaşımı: #manisa #butikpasta",
    "Amaç: Marka bilinirliği",
    "Hedef kitle: 25-40 yaş kadın, yerel",
    "Öncelik: Yüksek",
    "Gerekçe: Ürün çeşitliliğini göstermek",
    "Koşullar / Doğrulanacak: [DOĞRULANACAK] Yeterli kaliteli cupcake görseli varsa yayınlanacak.",
    "Story Desteği: Story: kısa arkasında-perde klip",
    "Üretim Notu: Doğal ışıkta çekim yapılmalı"
  ].join("\n");

  const parsed = parseContentPlanNotes(notes);
  assert.equal(parsed.source, "Instagram Intelligence");
  assert.equal(parsed.hook, "İlk 3 saniyede ürün detayına yakın çekim");
  assert.equal(parsed.contentFlow, "Açılış çekim -> üretim anı\n-> final ürün gösterimi", "multiline contentFlow must be preserved with its line break");
  assert.equal(parsed.caption, "El yapımı çeşit çeşit cupcake koleksiyonumuz burada!\nİkinci satır caption devamı.", "multiline caption must be preserved with its line break");
  assert.equal(parsed.cta, "DM'den sipariş verin");
  assert.equal(parsed.hashtagApproach, "#manisa #butikpasta");
  assert.equal(parsed.goal, "Marka bilinirliği");
  assert.equal(parsed.audience, "25-40 yaş kadın, yerel");
  assert.equal(parsed.priority, "Yüksek");
  assert.equal(parsed.rationale, "Ürün çeşitliliğini göstermek");
  assert.equal(parsed.conditions, "[DOĞRULANACAK] Yeterli kaliteli cupcake görseli varsa yayınlanacak.", "[DOĞRULANACAK] marker text must be preserved exactly");
  assert.equal(parsed.storySupport, "Story: kısa arkasında-perde klip");
  assert.equal(parsed.productionNotes, "Doğal ışıkta çekim yapılmalı");
  assert.equal(hasContentPlanDetails(parsed), true);
});

test("parseContentPlanNotes: unrecognized/manual free text is preserved, never silently dropped", () => {
  const parsed = parseContentPlanNotes("Bu satır elle eklenmiş, hiçbir etikete uymuyor.");
  assert.equal(parsed.unrecognized, "Bu satır elle eklenmiş, hiçbir etikete uymuyor.");
  assert.equal(hasContentPlanDetails(parsed), true);
});

test("parseContentPlanNotes REGRESSION — round-trips real buildNotes() output via a disposable fixture create", { skip: hasSupabase ? false : skipReason }, async () => {
  const { supabaseRest } = await import("../../../src/lib/supabase.ts");
  const { createContentPlanItems } = await import("../../../src/lib/instagram-intelligence/plan.ts");
  const unique = `QA-NotesParser-${Date.now()}`;
  const [company] = await supabaseRest<Array<{ id: string }>>("companies", {
    method: "POST", body: JSON.stringify({ name: unique, email: `${unique.toLocaleLowerCase("en")}@example.test`, is_test: true })
  });

  try {
    const created = await createContentPlanItems([{
      scheduled_date: "2027-03-01", topic: "Round-trip testi",
      hook: "Gerçek hook metni", caption: "Gerçek caption metni.\nİkinci satır.",
      conditions: "[DOĞRULANACAK] gerçek koşul metni", storySupport: "Gerçek story desteği"
    }], company.id);

    const parsed = parseContentPlanNotes(created.items[0].notes);
    assert.equal(parsed.hook, "Gerçek hook metni");
    assert.equal(parsed.caption, "Gerçek caption metni.\nİkinci satır.");
    assert.equal(parsed.conditions, "[DOĞRULANACAK] gerçek koşul metni");
    assert.equal(parsed.storySupport, "Gerçek story desteği");
  } finally {
    const { CONTENT_PLAN_TABLE } = await import("../../../src/lib/content-plan/types.ts");
    await supabaseRest(`${CONTENT_PLAN_TABLE}?company_id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
    await supabaseRest(`companies?id=eq.${company.id}`, { method: "DELETE" }).catch(() => {});
  }
});

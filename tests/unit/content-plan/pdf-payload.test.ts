// buildContentPlanDocumentPayload() — customer vs. internal PDF payload
// construction (field-hierarchy layout: one small section per field, not
// one long label:value paragraph per item), and a real PDF generation
// smoke test through the canonical document-generator.ts engine. Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/content-plan/*.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildContentPlanDocumentPayload } from "../../../src/lib/content-plan/pdf-payload.ts";
import type { DocumentPayload } from "../../../src/lib/server/document-generator.ts";
import type { ContentPlanItem } from "../../../src/lib/content-plan/types.ts";

function makeItem(overrides: Partial<ContentPlanItem>): ContentPlanItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    workspace_id: "hk-dijital",
    company_id: "00000000-0000-4000-8000-000000000000",
    scheduled_date: "2027-04-01",
    platforms: ["instagram"],
    theme: "Tanıtım",
    content_title: "Cupcake vitrini",
    content_format: "reels",
    notes: [
      "[Kaynak: Instagram Intelligence]",
      "Hook: Yakın çekim açılış",
      "İçerik Akışı: A -> B -> C",
      "Caption: Uzun bir caption metni burada devam ediyor ve gerçek bir üretim notu olarak kalıyor.",
      "CTA: DM'den yazın",
      "Hashtag Yaklaşımı: #manisa #cupcake",
      "Amaç: Marka bilinirliği",
      "Hedef kitle: Yerel, 25-40 yaş",
      "Öncelik: Yüksek",
      "Gerekçe: İç stratejik gerekçe metni",
      "Koşullar / Doğrulanacak: [DOĞRULANACAK] iç doğrulama placeholder metni",
      "Story Desteği: Story anket sonucu paylaşılacak",
      "Üretim Notu: Doğal ışıkta çek"
    ].join("\n"),
    is_published: false,
    published_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides
  };
}

/** Flattens every section's title/text/items into one string, for content-
 * presence checks — the field-separation itself is asserted separately by
 * checking that each field has its OWN section (see the "field hierarchy"
 * test below), not by this flattened string. */
function flatten(payload: DocumentPayload): string {
  return payload.sections.map((s) => [s.title, s.text, ...(s.items || [])].filter(Boolean).join("\n")).join("\n");
}

function sectionTitles(payload: DocumentPayload): string[] {
  return payload.sections.map((s) => s.title);
}

test("buildContentPlanDocumentPayload: customer mode excludes internal-only fields and never leaks the raw [DOĞRULANACAK] placeholder", () => {
  const payload = buildContentPlanDocumentPayload("MY CAKE 45", [makeItem({})], "customer");
  const text = flatten(payload);
  assert.match(text, /Yakın çekim açılış/);
  assert.match(text, /DM'den yazın/);
  assert.match(text, /manisa/);
  assert.match(text, /Marka bilinirliği/);
  assert.match(text, /Yerel, 25-40 yaş/);
  assert.match(text, /Story anket sonucu/);

  const titles = sectionTitles(payload);
  assert.ok(titles.includes("HOOK"));
  assert.ok(titles.includes("CTA"));
  assert.ok(titles.includes("CAPTION"));

  assert.doesNotMatch(text, /İç stratejik gerekçe metni/, "internal rationale must not appear in the customer PDF");
  assert.doesNotMatch(text, /Yüksek/, "internal priority value must not appear in the customer PDF");
  assert.doesNotMatch(text, /Doğal ışıkta çek/, "internal production notes must not appear in the customer PDF");
  assert.doesNotMatch(text, /\[DOĞRULANACAK\]/, "the raw internal placeholder marker must never reach the customer PDF");
  assert.doesNotMatch(text, /iç doğrulama placeholder metni/, "the raw internal condition text must never reach the customer PDF");
  assert.doesNotMatch(text, /Instagram Intelligence/, "no source/debug metadata in the customer PDF");
  assert.doesNotMatch(text, /AJANS İÇİ NOTLAR/, "the internal-notes divider must never appear in the customer PDF");
  assert.match(text, /teyit edilecek/i, "an honest neutral note must replace the unverified condition instead of silently dropping it");
});

test("buildContentPlanDocumentPayload: internal mode includes rationale/priority/conditions/production notes verbatim, each as its own field section", () => {
  const payload = buildContentPlanDocumentPayload("MY CAKE 45", [makeItem({})], "internal");
  const text = flatten(payload);
  assert.match(text, /İç stratejik gerekçe metni/);
  assert.match(text, /Yüksek/);
  assert.match(text, /\[DOĞRULANACAK\] iç doğrulama placeholder metni/, "internal PDF must preserve the raw [DOĞRULANACAK] text verbatim");
  assert.match(text, /Doğal ışıkta çek/);
  assert.equal(payload.confidentialLabel, "Dahili Kullanım");

  const titles = sectionTitles(payload);
  assert.ok(titles.includes("STRATEJİK GEREKÇE"));
  assert.ok(titles.some((t) => t.includes("KOŞULLAR")));
  assert.ok(titles.includes("ÜRETİM NOTU"));
  assert.ok(titles.includes("AJANS İÇİ NOTLAR"), "internal-only fields must be grouped under a clearly separate divider");
});

test("buildContentPlanDocumentPayload: field hierarchy — each field is its own section (title = label), not merged into one paragraph", () => {
  const payload = buildContentPlanDocumentPayload("MY CAKE 45", [makeItem({})], "customer");
  const fieldSections = payload.sections.filter((s) => s.titleSize && s.titleSize < 14);
  assert.ok(fieldSections.length >= 6, "at least Hook/İçerik Akışı/Caption/CTA/Hashtag/Amaç/Hedef Kitle/Story Desteği must each be separate sections");
  // No single section may contain more than one field's worth of "Label:" prose
  // the way the old single-blob layout did — each field section's own text
  // should correspond to only its own label's value, proven by the title
  // itself being the short field label, not a joined multi-field string.
  for (const s of fieldSections) assert.ok(s.title.length < 30, `field section title "${s.title}" must be a short label, not a merged paragraph`);
});

test("buildContentPlanDocumentPayload: content flow with multiple real lines is rendered as a numbered list, never fabricated", () => {
  const item = makeItem({
    notes: ["[Kaynak: Instagram Intelligence]", "İçerik Akışı: 0-2 sn tam pasta\nKrema yüzeyi yakın plan\nSon kare tam pasta"].join("\n")
  });
  const payload = buildContentPlanDocumentPayload("MY CAKE 45", [item], "customer");
  const flowSection = payload.sections.find((s) => s.title === "İÇERİK AKIŞI");
  assert.ok(flowSection);
  assert.match(flowSection!.text || "", /1\. 0-2 sn tam pasta/);
  assert.match(flowSection!.text || "", /2\. Krema yüzeyi yakın plan/);
  assert.match(flowSection!.text || "", /3\. Son kare tam pasta/);
});

test("buildContentPlanDocumentPayload: content flow whose lines already carry their own numbering is never double-numbered", () => {
  const item = makeItem({ notes: ["[Kaynak: Instagram Intelligence]", "İçerik Akışı: 1 kapak.\n2 Adım 1: mesaj.\n3 Adım 2: onay [DOĞRULANACAK]."].join("\n") });
  const payload = buildContentPlanDocumentPayload("MY CAKE 45", [item], "internal");
  const flowSection = payload.sections.find((s) => s.title === "İÇERİK AKIŞI");
  assert.equal(flowSection!.text, "1 kapak.\n2 Adım 1: mesaj.\n3 Adım 2: onay [DOĞRULANACAK].");
  assert.doesNotMatch(flowSection!.text || "", /^1\. 1 kapak/, "must never double-number a line that already starts with its own number");
});

test("buildContentPlanDocumentPayload: a single-line content flow is kept intact, never force-split mid-sentence", () => {
  const item = makeItem({ notes: ["[Kaynak: Instagram Intelligence]", "İçerik Akışı: Tek cümlelik akış açıklaması, virgüllü ve tire içeren - ama tek fikir."].join("\n") });
  const payload = buildContentPlanDocumentPayload("MY CAKE 45", [item], "customer");
  const flowSection = payload.sections.find((s) => s.title === "İÇERİK AKIŞI");
  assert.equal(flowSection!.text, "Tek cümlelik akış açıklaması, virgüllü ve tire içeren - ama tek fikir.");
});

test("buildContentPlanDocumentPayload: header section carries the content title, page-break hints, and compact date/format metadata", () => {
  const payload = buildContentPlanDocumentPayload("MY CAKE 45", [makeItem({})], "customer");
  const header = payload.sections[0];
  assert.match(header.title, /^1\. CUPCAKE VİTRİNİ$/i);
  assert.equal(header.titleSize, 14);
  assert.ok(header.minSpaceBefore && header.minSpaceBefore > 30, "a content item's header must reserve enough space to avoid an orphaned title at the bottom of a page");
  assert.match(header.text || "", /REELS/);
  assert.match(header.text || "", /Tanıtım/);
});

test("buildContentPlanDocumentPayload: correct company name and date-range period across multiple items, sorted ascending", () => {
  const items = [
    makeItem({ id: "a", scheduled_date: "2027-04-05", content_title: "İkinci" }),
    makeItem({ id: "b", scheduled_date: "2027-04-01", content_title: "Birinci" }),
    makeItem({ id: "c", scheduled_date: "2027-04-20", content_title: "Üçüncü" })
  ];
  const payload = buildContentPlanDocumentPayload("MY CAKE 45", items, "customer");
  assert.equal(payload.customerName, "MY CAKE 45");
  const headers = payload.sections.filter((s) => s.titleSize === 14);
  assert.equal(headers.length, 3);
  assert.match(headers[0].title, /BİRİNCİ/i, "sections must be sorted by scheduled_date ascending regardless of input order");
  assert.match(payload.period, /2027/);
});

test("generatePdfBuffer smoke test: customer and internal PDFs both generate a real, valid multi-item PDF with Turkish characters and long text", async () => {
  const { generatePdfBuffer } = await import("../../../src/lib/server/document-generator.ts");
  const longCaption = "Çok uzun bir açıklama metni ".repeat(40) + "ğüşiöçÇĞÜŞİÖ";
  const items = Array.from({ length: 13 }, (_, i) => makeItem({
    id: `item-${i}`,
    scheduled_date: `2027-05-${String(i + 1).padStart(2, "0")}`,
    content_title: `İçerik ${i + 1} — Türkçe karakterli başlık çÇğĞıİöÖşŞüÜ`,
    notes: [`[Kaynak: Instagram Intelligence]`, `Caption: ${longCaption}`, "İçerik Akışı: Adım bir\nAdım iki\nAdım üç"].join("\n")
  }));

  for (const mode of ["customer", "internal"] as const) {
    const payload = buildContentPlanDocumentPayload("MY CAKE 45", items, mode);
    const buffer = await generatePdfBuffer(payload);
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 500, "a real multi-page PDF must be non-trivially sized");
    assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-", "must be a real PDF binary");
  }
});

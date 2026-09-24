// buildContentPlanDocumentPayload() — customer vs. internal PDF payload
// construction, and a real PDF generation smoke test through the
// canonical document-generator.ts engine. Run via:
//   node --env-file=.env.local --conditions=react-server --import tsx --test tests/unit/content-plan/*.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { buildContentPlanDocumentPayload } from "../../../src/lib/content-plan/pdf-payload.ts";
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

test("buildContentPlanDocumentPayload: customer mode excludes internal-only fields and never leaks the raw [DOĞRULANACAK] placeholder", () => {
  const payload = buildContentPlanDocumentPayload("MY CAKE 45", [makeItem({})], "customer");
  const text = payload.sections[0].text || "";
  assert.match(text, /Hook: Yakın çekim açılış/);
  assert.match(text, /Caption:/);
  assert.match(text, /CTA:/);
  assert.match(text, /Hashtag Yaklaşımı:/);
  assert.match(text, /Amaç:/);
  assert.match(text, /Hedef Kitle:/);
  assert.match(text, /Story Desteği:/);

  assert.doesNotMatch(text, /Gerekçe:/, "internal rationale must not appear in the customer PDF");
  assert.doesNotMatch(text, /Öncelik:/, "internal priority must not appear in the customer PDF");
  assert.doesNotMatch(text, /Üretim Notu:/, "internal production notes must not appear in the customer PDF");
  assert.doesNotMatch(text, /\[DOĞRULANACAK\]/, "the raw internal placeholder marker must never reach the customer PDF");
  assert.doesNotMatch(text, /iç doğrulama placeholder metni/, "the raw internal condition text must never reach the customer PDF");
  assert.doesNotMatch(text, /Instagram Intelligence/, "no source/debug metadata in the customer PDF");
  assert.match(text, /teyit edilecek/i, "an honest neutral note must replace the unverified condition instead of silently dropping it");
});

test("buildContentPlanDocumentPayload: internal mode includes rationale/priority/conditions/production notes verbatim", () => {
  const payload = buildContentPlanDocumentPayload("MY CAKE 45", [makeItem({})], "internal");
  const text = payload.sections[0].text || "";
  assert.match(text, /Gerekçe: İç stratejik gerekçe metni/);
  assert.match(text, /Öncelik: Yüksek/);
  assert.match(text, /Koşullar \/ Doğrulanacak: \[DOĞRULANACAK\] iç doğrulama placeholder metni/, "internal PDF must preserve the raw [DOĞRULANACAK] text verbatim");
  assert.match(text, /Üretim Notu: Doğal ışıkta çek/);
  assert.equal(payload.confidentialLabel, "Dahili Kullanım");
});

test("buildContentPlanDocumentPayload: correct company name and date-range period across multiple items", () => {
  const items = [
    makeItem({ id: "a", scheduled_date: "2027-04-05", content_title: "İkinci" }),
    makeItem({ id: "b", scheduled_date: "2027-04-01", content_title: "Birinci" }),
    makeItem({ id: "c", scheduled_date: "2027-04-20", content_title: "Üçüncü" })
  ];
  const payload = buildContentPlanDocumentPayload("MY CAKE 45", items, "customer");
  assert.equal(payload.customerName, "MY CAKE 45");
  assert.equal(payload.sections.length, 3);
  assert.match(payload.sections[0].title || "", /Birinci/, "sections must be sorted by scheduled_date ascending regardless of input order");
  assert.match(payload.period, /2027/);
});

test("generatePdfBuffer smoke test: customer and internal PDFs both generate a real, valid multi-item PDF with Turkish characters and long text", async () => {
  const { generatePdfBuffer } = await import("../../../src/lib/server/document-generator.ts");
  const longCaption = "Çok uzun bir açıklama metni ".repeat(40) + "ğüşiöçÇĞÜŞİÖ";
  const items = Array.from({ length: 5 }, (_, i) => makeItem({
    id: `item-${i}`,
    scheduled_date: `2027-05-${String(i + 1).padStart(2, "0")}`,
    content_title: `İçerik ${i + 1} — Türkçe karakterli başlık çÇğĞıİöÖşŞüÜ`,
    notes: [`[Kaynak: Instagram Intelligence]`, `Caption: ${longCaption}`].join("\n")
  }));

  for (const mode of ["customer", "internal"] as const) {
    const payload = buildContentPlanDocumentPayload("MY CAKE 45", items, mode);
    const buffer = await generatePdfBuffer(payload);
    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 500, "a real multi-page PDF must be non-trivially sized");
    assert.equal(buffer.subarray(0, 5).toString("latin1"), "%PDF-", "must be a real PDF binary");
  }
});

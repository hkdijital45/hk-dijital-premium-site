// Rapor Merkezi V2 catalog + request parsing, and the shared Turkish text
// utilities used by every PDF/Word workflow (Premium PDF V3.1). Pure
// functions only — runs in the default CI unit suite.
import test from "node:test";
import assert from "node:assert/strict";
import {
  REPORT_CATEGORIES, REPORT_TYPES, REPORT_TYPE_BY_KEY, isReportTypeKey, ownerSupportLabel, parseReportRef
} from "../../src/lib/report-center-v2/catalog.ts";
import { contentDisposition, ownerFromParams, variantFromParams } from "../../src/lib/report-center-v2/params.ts";
import {
  capitalizeWordsTr, cleanTurkishTypography, findUsedGlossaryTerms, humanizeKeyTr, restoreProtectedTerms, trUpper
} from "../../src/lib/turkish-text.ts";

test("catalog — every type belongs to a real category, has an owner and a module gate", () => {
  const categoryKeys = new Set(REPORT_CATEGORIES.map((c) => c.key));
  for (const def of REPORT_TYPES) {
    assert.ok(categoryKeys.has(def.category), `${def.key} category`);
    assert.ok(def.owners.length > 0, `${def.key} owners`);
    assert.ok(def.modules.length > 0, `${def.key} modules`);
    assert.ok(def.variants.length > 0, `${def.key} variants`);
    assert.ok(def.formats.pdf, `${def.key} must at least be viewable as PDF`);
  }
});

test("catalog — no duplicate type keys and no empty categories", () => {
  assert.equal(new Set(REPORT_TYPES.map((t) => t.key)).size, REPORT_TYPES.length);
  for (const category of REPORT_CATEGORIES) {
    assert.ok(REPORT_TYPES.some((t) => t.category === category.key), `${category.label} must not be empty`);
  }
  assert.equal(REPORT_TYPE_BY_KEY.size, REPORT_TYPES.length);
});

test("catalog — Reklam Doktoru Pro groups the real ad report sources; internal pre-audits stay separate from client ones", () => {
  const adDoctor = REPORT_TYPES.filter((t) => t.category === "reklam-doktoru").map((t) => t.key).sort();
  assert.deepEqual(adDoctor, ["ad_creative_report", "ad_evaluation", "ad_strategy", "candidate_evaluation", "manual_evaluation"]);
  assert.deepEqual(REPORT_TYPE_BY_KEY.get("pre_audit_internal")?.variants, ["internal"]);
  assert.deepEqual(REPORT_TYPE_BY_KEY.get("pre_audit_client")?.variants, ["client"]);
  assert.equal(REPORT_TYPE_BY_KEY.get("analytics_report")?.formats.docx, false, "stored PDFs are never offered as Word");
});

test("catalog — compound refs parse only for known types", () => {
  assert.deepEqual(parseReportRef("proposal:abc"), { type: "proposal", sourceId: "abc" });
  assert.equal(parseReportRef("unknown:abc"), null);
  assert.equal(parseReportRef("proposal:"), null);
  assert.equal(parseReportRef("proposal"), null);
  assert.equal(isReportTypeKey("__proto__"), false);
  assert.match(ownerSupportLabel(REPORT_TYPE_BY_KEY.get("ad_evaluation")!), /yalnızca müşteri/);
  assert.match(ownerSupportLabel(REPORT_TYPE_BY_KEY.get("proposal")!), /Lead ve müşteri/);
});

test("params — owner type is whitelisted; variant falls back to an available one", () => {
  assert.deepEqual(ownerFromParams(new URLSearchParams("ownerType=lead&ownerId=x")), { type: "lead", id: "x" });
  assert.equal(ownerFromParams(new URLSearchParams("ownerType=unit&ownerId=x")).type, "");
  assert.equal(variantFromParams(new URLSearchParams("variant=internal"), ["client"]), "client", "an unavailable internal variant is never served");
  assert.equal(variantFromParams(new URLSearchParams("variant=internal"), ["client", "internal"]), "internal");
  assert.equal(variantFromParams(new URLSearchParams("variant=evil"), ["internal"]), "internal");
});

test("params — Content-Disposition keeps Turkish names with an ASCII fallback (no header injection)", () => {
  const header = contentDisposition(true, "zirve-akademi-ön-inceleme-müşteri.pdf");
  assert.match(header, /^inline; filename="zirve-akademi-on-inceleme-musteri\.pdf"; filename\*=UTF-8''/);
  const attachment = contentDisposition(false, "a\"b\r\nX-Evil: 1.pdf");
  assert.match(attachment, /^attachment; filename="a-b-X-Evil-1\.pdf"/);
  assert.doesNotMatch(attachment, /[\r\n]/);
});

test("Turkish casing — brand names and dotted/dotless i are preserved", () => {
  assert.equal(capitalizeWordsTr("işletme özeti"), "İşletme Özeti");
  assert.equal(capitalizeWordsTr("whatsapp iletişim"), "WhatsApp İletişim");
  assert.equal(capitalizeWordsTr("instagram ve google ads"), "Instagram ve Google Ads");
  assert.equal(restoreProtectedTerms("my cake 45 ve zirve akademi"), "MY CAKE 45 ve Zirve AKADEMİ");
  assert.equal(restoreProtectedTerms("ınstagram ve meta ads"), "Instagram ve Meta Ads");
  assert.equal(trUpper("istanbul"), "İSTANBUL");
  assert.equal(humanizeKeyTr("tiktok_profile"), "TikTok Profile");
});

test("Turkish typography — spacing and combining dots are normalized", () => {
  assert.equal(cleanTurkishTypography("Erişim ,gösterim ;  tıklama ( CTR )"), "Erişim, gösterim; tıklama (CTR)");
  assert.equal(cleanTurkishTypography("i̇nceleme"), "inceleme");
});

test("glossary — only terms actually used are listed (suffix tolerant, never inline)", () => {
  const terms = findUsedGlossaryTerms(["CTR'ı yüksek, CPM düştü."], [
    { term: "CTR", definition: "Tıklama oranı" },
    { term: "CPM", definition: "Bin gösterim maliyeti" },
    { term: "ROAS", definition: "Reklam harcaması getirisi" }
  ]);
  assert.deepEqual(terms.map((t) => t.term), ["CTR", "CPM"]);
});

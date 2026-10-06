import test from "node:test";
import assert from "node:assert/strict";
import { buildPreAuditLeadPrompt } from "../../src/lib/pre-audit-lead-prompt.ts";
import { preAnalysisLeadFields } from "../../src/lib/pre-analysis-lead.ts";
import { realPhoneDigits, resolvePublicPhoneNumber, resolvePublicTelHref, resolvePublicWhatsappNumber, resolvePublicWhatsappUrl } from "../../src/lib/public-contact.ts";

const FULL_LEAD = {
  company: "Örnek Pasta",
  business_type: "Pastacılık",
  address: "Yunusemre Mah. 1. Sokak No: 5",
  instagram: "ornekpasta",
  website: "https://ornekpasta.example",
  goal: "Daha Fazla Satış",
  budget: "5.000-20.000 TL",
  platforms_label: "Meta, Google Ads",
  message: "Sipariş yoğunluğu yüksek",
  pre_analysis: { contentNeed: "Düzenli içerik", startTiming: "Hemen", socialStatus: "Aktif ama düzensiz" }
};

test("the prompt uses the actual stored values and labels them in Turkish", () => {
  const prompt = buildPreAuditLeadPrompt("lead-1", FULL_LEAD);
  assert.match(prompt, /Firma:\nÖrnek Pasta/);
  assert.match(prompt, /Açık Adres:\nYunusemre Mah\. 1\. Sokak No: 5/);
  assert.match(prompt, /İlgilendiği Platformlar:\nMeta, Google Ads/);
  assert.match(prompt, /Mevcut Sosyal Medya Durumu:\nAktif ama düzensiz/);
  assert.match(prompt, /Lead ID: lead-1/);
});

test("missing optional values are omitted, never rendered as undefined, null, [] or {}", () => {
  const prompt = buildPreAuditLeadPrompt("lead-2", { company: "Yalnız Firma", platforms_label: "", pre_analysis: null, address: null, website: "" });
  assert.match(prompt, /Firma:\nYalnız Firma/);
  assert.doesNotMatch(prompt, /Açık Adres/);
  assert.doesNotMatch(prompt, /Web Sitesi/);
  assert.doesNotMatch(prompt, /İlgilendiği Platformlar/);
  assert.doesNotMatch(prompt, /undefined|null|\[\]|\{\}/);
});

test("the copied prompt never includes name, email or phone", () => {
  const prompt = buildPreAuditLeadPrompt("lead-3", { ...FULL_LEAD });
  assert.doesNotMatch(prompt, /@/);
  assert.doesNotMatch(prompt, /\+?90\s?5\d{2}/);
});

test("the prompt contains no AI-provider claim and no invented metrics", () => {
  const prompt = buildPreAuditLeadPrompt("lead-4", FULL_LEAD);
  assert.match(prompt, /Bulamadığın bilgiyi uydurma/);
  assert.doesNotMatch(prompt, /takipçi sayısı:|ciro:|ROAS:/i);
});

test("pre-analysis answers and address map to lead fields, with null when nothing was answered", () => {
  const mapped = preAnalysisLeadFields({ address: "  Yunusemre Mah.  ", contentNeed: "Düzenli içerik", urgency: "Hemen", socialStatus: "Aktif" });
  assert.equal(mapped.address, "Yunusemre Mah.");
  assert.deepEqual(mapped.pre_analysis, { contentNeed: "Düzenli içerik", startTiming: "Hemen", socialStatus: "Aktif" });
  assert.deepEqual(preAnalysisLeadFields({}), { address: "", pre_analysis: null });
});

test("the address is capped at 500 characters", () => {
  assert.equal(preAnalysisLeadFields({ address: "a".repeat(900) }).address.length, 500);
});

test("placeholder phone and WhatsApp numbers never resolve to a public link", () => {
  assert.equal(resolvePublicTelHref("+90 555 000 00 00", undefined), null);
  assert.equal(resolvePublicPhoneNumber("", undefined), null);
  assert.equal(resolvePublicWhatsappNumber("+905550000000", undefined), null);
  assert.equal(resolvePublicWhatsappUrl("", "+905550000000", undefined), null);
  assert.equal(realPhoneDigits("123"), null);
});

test("a valid configured phone produces a tel: link, and the env value wins", () => {
  assert.equal(resolvePublicTelHref("+90 555 000 00 00", "+90 532 123 45 67"), "tel:+905321234567");
  assert.equal(resolvePublicTelHref("+90 532 111 22 33", undefined), "tel:+905321112233");
});

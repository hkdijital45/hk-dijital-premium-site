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

// ---- Staff prep notes now reaching the prompt (root cause: the field KEYS
// existed in the UI but buildPreAuditLeadPrompt's own function signature
// never accepted them, so every manual observation/note was silently lost) ----

test("REGRESSION — with no prep argument at all, the dynamic staff-notes section is entirely absent (never an empty header)", () => {
  const prompt = buildPreAuditLeadPrompt("lead-5", FULL_LEAD);
  assert.doesNotMatch(prompt, /HK DİJİTAL İÇ DEĞERLENDİRME NOTLARI/);
});

test("REGRESSION — with a prep object but every field empty, the dynamic section is still omitted (no fabricated empty bölüm)", () => {
  const prompt = buildPreAuditLeadPrompt("lead-6", FULL_LEAD, { advertising_status: "unknown" });
  assert.doesNotMatch(prompt, /HK DİJİTAL İÇ DEĞERLENDİRME NOTLARI/);
});

test("REGRESSION — every staff observation field reaches the prompt verbatim, unabridged", () => {
  const prompt = buildPreAuditLeadPrompt("lead-7", FULL_LEAD, {
    social_observations: "Instagram'da son 3 ayda hiç paylaşım yok, hikaye de yok.",
    business_notes: "Manisa Muradiye Mahallesinde bulunan işletme.",
    advertising_status: "yes",
    potential_reason: "Meta reklamımızdan müşteri kendisi başvurdu.",
    focus_notes: "Rakip fiyatlandırmasına özellikle bak.",
    competitor_reference: "Örnek Rakip İşletme"
  });
  assert.match(prompt, /Sosyal Medya Gözlemlerim:\nInstagram'da son 3 ayda hiç paylaşım yok, hikaye de yok\./);
  assert.match(prompt, /İşletme Hakkında Notlarım:\nManisa Muradiye Mahallesinde bulunan işletme\./);
  assert.match(prompt, /Reklam Veriyor Mu\?:\nEvet/);
  assert.match(prompt, /Neden Potansiyel Müşteri\?:\nMeta reklamımızdan müşteri kendisi başvurdu\./);
  assert.match(prompt, /Özellikle İncelenmesi İstenen Alanlar:\nRakip fiyatlandırmasına özellikle bak\./);
  assert.match(prompt, /Rakip \/ Örnek İşletme:\nÖrnek Rakip İşletme/);
});

test("REGRESSION — advertising_status 'unknown' is omitted entirely, never fabricated as 'Bilinmiyor'", () => {
  const prompt = buildPreAuditLeadPrompt("lead-8", FULL_LEAD, { advertising_status: "unknown", social_observations: "test" });
  assert.doesNotMatch(prompt, /Reklam Veriyor Mu\?/);
});

test("'Ön incelemeyi kim talep etti?' — customer-requested is stated plainly", () => {
  const prompt = buildPreAuditLeadPrompt("lead-9", FULL_LEAD, { requested_by: "customer" });
  assert.match(prompt, /Ön İncelemeyi Talep Eden:\nMüşteri kendisi talep etti/);
});

test("'Ön incelemeyi kim talep etti?' — HK Dijital-initiated is never phrased as a customer request", () => {
  const prompt = buildPreAuditLeadPrompt("lead-10", FULL_LEAD, { requested_by: "hk_dijital" });
  assert.match(prompt, /Ön İncelemeyi Talep Eden:\nHK Dijital tarafından önerildi \/ başlatıldı/);
  assert.doesNotMatch(prompt, /Ön İncelemeyi Talep Eden:\nMüşteri kendisi/);
});

test("'Diğer' combines the label and the manual description with an em dash, exactly as specified", () => {
  const prompt = buildPreAuditLeadPrompt("lead-11", FULL_LEAD, {
    requested_by: "other",
    requested_by_detail: "İşletmeye tanıtım görüşmesinde HK Dijital tarafından ön inceleme teklif edildi."
  });
  assert.match(prompt, /Ön İncelemeyi Talep Eden:\nDiğer — İşletmeye tanıtım görüşmesinde HK Dijital tarafından ön inceleme teklif edildi\./);
});

test("the dynamic section always carries the 'context not fact' disclaimer and the requester-framing rule", () => {
  const prompt = buildPreAuditLeadPrompt("lead-12", FULL_LEAD, { social_observations: "x" });
  assert.match(prompt, /doğrulanmamış iddiaları kesin gerçek olarak sunma/);
  assert.match(prompt, /Müşteri kendisi talep etti.*seçili değilse/);
});

test("source and google_maps_url reach the prompt when present, omitted when absent", () => {
  const withBoth = buildPreAuditLeadPrompt("lead-13", { ...FULL_LEAD, source: "Website", google_maps_url: "https://maps.google.com/?q=ornek" });
  assert.match(withBoth, /Lead Kaynağı:\nWebsite/);
  assert.match(withBoth, /Google Maps:\nhttps:\/\/maps\.google\.com\/\?q=ornek/);
  const withoutEither = buildPreAuditLeadPrompt("lead-14", { ...FULL_LEAD, source: null, google_maps_url: null });
  assert.doesNotMatch(withoutEither, /Lead Kaynağı/);
  assert.doesNotMatch(withoutEither, /Google Maps:\n/);
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

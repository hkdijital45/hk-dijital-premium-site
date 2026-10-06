import test from "node:test";
import assert from "node:assert/strict";
import { CONTACT_LEAD_SOURCE, findDuplicateLeads, isConverted, leadInsertPayload, leadValuesFromRequest, normalizePhoneDigits, statusKeyFor, validateConversionValues } from "../../src/lib/contact-requests.ts";

const REQUEST = { id: "r1", name: "Ayşe Yılmaz", company: "Test  AŞ", phone: "0 532 111 22 33", email: "Ayse@Test.com", message: "Teklif istiyorum", source: "Web Sitesi", status: "Yeni", created_at: "2026-10-07T10:00:00Z" };

test("status labels round-trip and unknown values fall back to new", () => {
  assert.equal(statusKeyFor("Lead'e Dönüştürüldü"), "converted");
  assert.equal(statusKeyFor("Arşivlendi"), "archived");
  assert.equal(statusKeyFor(""), "new");
  assert.equal(statusKeyFor("Bilinmeyen"), "new");
});

test("a request with a converted lead reference counts as converted, even if the label lags", () => {
  assert.equal(isConverted({ status: "Yeni", converted_lead_id: "L1" }), true);
  assert.equal(isConverted({ status: "Yeni", converted_lead_id: null }), false);
});

test("phone normalization covers local and international forms", () => {
  assert.equal(normalizePhoneDigits("0 532 111 22 33"), "905321112233");
  assert.equal(normalizePhoneDigits("+90 532 111 22 33"), "905321112233");
  assert.equal(normalizePhoneDigits("5321112233"), "905321112233");
});

test("the request maps to canonical lead values with the existing contact source and status", () => {
  const values = leadValuesFromRequest(REQUEST);
  assert.deepEqual(values, { company: "Test  AŞ", name: "Ayşe Yılmaz", phone: "905321112233", email: "ayse@test.com", message: "Teklif istiyorum" });
  const payload = leadInsertPayload(values);
  assert.equal(payload.source, CONTACT_LEAD_SOURCE);
  assert.equal(payload.source, "İletişim Formu");
  assert.equal(payload.status, "Yeni");
});

test("admin-reviewed values are validated before conversion", () => {
  assert.equal(validateConversionValues({ company: "", name: "", phone: "", email: "" }).ok, false);
  assert.equal(validateConversionValues({ company: "X", name: "", phone: "", email: "bad-email" }).ok, false);
  assert.equal(validateConversionValues({ company: "X", name: "", phone: "5321112233", email: "" }).ok, true);
  assert.equal(validateConversionValues(null).ok, false);
});

test("duplicate matching uses normalized phone, email and company only", () => {
  const values = leadValuesFromRequest(REQUEST);
  const candidates = [
    { id: "L1", company: "test aş", name: "Başka", phone: "+90 532 111 22 33", email: null, status: "Yeni" },
    { id: "L2", company: "Farklı", name: "Kişi", phone: "5550001122", email: "ayse@test.com", status: "Takipte" },
    { id: "L3", company: "Test AŞ Ltd", name: "Yakın ama farklı", phone: "5559998877", email: "x@y.com", status: "Yeni" },
    { id: "L4", company: "Silinmiş", phone: "905321112233", deleted_at: "2026-01-01T00:00:00Z" }
  ];
  const matches = findDuplicateLeads(values, candidates);
  assert.deepEqual(matches.map((m) => m.leadId), ["L1", "L2"]);
  assert.deepEqual(matches[0].reasons, ["telefon", "firma"]);
  assert.deepEqual(matches[1].reasons, ["e-posta"]);
  assert.equal(matches.some((m) => m.leadId === "L3"), false, "fuzzy company suffixes must not match");
  assert.equal(matches.some((m) => m.leadId === "L4"), false, "deleted leads are never suggested");
});

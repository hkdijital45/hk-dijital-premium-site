import assert from "node:assert/strict";
import test from "node:test";
import { auditConvertedLeads, fillBlankFields, isSameBusiness, normalizeBusinessName, resolveConversionCompany } from "../../src/lib/lead-conversion.ts";

const liya = { id: "c-liya", name: "LİYA MASAJ – Spa & Güzellik", status: "Aktif", phone: "0555" };
const sante = { id: "c-sante", name: "Sante Spa & Masaj Salonu Manisa", status: "Aktif" };
const lead = { id: "l-sante", company: "Sante Spa & Masaj Salonu Manisa", phone: "0555", email: "owner@x.com", status: "Kazanıldı" };

test("ad normalizasyonu Türkçe karakter ve noktalamaya dayanıklı", () => {
  assert.equal(normalizeBusinessName("LİYA MASAJ – Spa & Güzellik"), "liya masaj spa guzellik");
  assert.equal(isSameBusiness("Sante SPA", "sante spa"), true);
  assert.equal(isSameBusiness("", ""), false);
  assert.equal(isSameBusiness("Sante Spa", "Liya Masaj"), false);
});

test("aynı telefonu paylaşan farklı işletme Liya'ya bağlanmaz (kök neden)", () => {
  const r = resolveConversionCompany({ ...lead, company_id: null }, [liya], []);
  assert.deepEqual(r, { action: "create", reason: "no-match", staleCompanyId: undefined });
});

test("lead yanlışlıkla Liya'ya bağlıysa bağ güvenilmez, yeni şirket oluşturulur", () => {
  const r = resolveConversionCompany({ ...lead, company_id: "c-liya" }, [liya], [{ id: "cu1", company_id: "c-liya", source_lead_id: "l-sante" }]);
  assert.equal(r.action, "create");
  assert.equal((r as any).reason, "stale-link");
});

test("ikinci dönüşüm mükerrer şirket oluşturmaz", () => {
  const r = resolveConversionCompany({ ...lead, company_id: "c-sante" }, [liya, sante], [{ id: "cu2", company_id: "c-sante", source_lead_id: "l-sante" }]);
  assert.equal(r.action, "reuse");
  assert.equal((r as any).company.id, "c-sante");
  assert.equal(resolveConversionCompany({ ...lead, company_id: null }, [liya, sante], []).action, "reuse");
});

test("arşivli aynı adlı şirket yeniden kullanılmaz; boş alanlar eşleşme sayılmaz", () => {
  assert.equal(resolveConversionCompany({ ...lead }, [{ ...sante, status: "Arşivli" }], []).action, "create");
  const blank = { id: "l2", company: "", phone: "", email: "", website: "" };
  assert.equal(resolveConversionCompany(blank, [{ id: "x", name: "", phone: "" }], []).action, "create");
});

test("fillBlankFields dolu veriyi ezmez", () => {
  assert.deepEqual(fillBlankFields({ phone: "1", email: "" }, { phone: "2", email: "a@b.c", website: "" }), { email: "a@b.c" });
});

test("denetim: bağlantısız, kayıp, ad uyuşmaz ve müşterisiz dönüşümleri bulur", () => {
  const leads = [
    { id: "a", company: "Sante", status: "Müşteri Oldu", company_id: "c-liya" },
    { id: "b", company: "X", status: "Müşteri Oldu", company_id: null },
    { id: "c", company: "Y", status: "Müşteri Oldu", company_id: "yok" },
    { id: "d", company: "Liya Masaj Spa Güzellik", status: "Müşteri Oldu", company_id: "c-liya" },
    { id: "e", company: "Yeni", status: "Yeni Başvuru", company_id: null }
  ];
  const issues = auditConvertedLeads(leads, [liya], [{ company_id: "c-liya" }]);
  assert.deepEqual(issues.map((i) => [i.leadId, i.issue]), [["a", "name-mismatch"], ["b", "no-company-link"], ["c", "company-missing"]]);
  assert.deepEqual(auditConvertedLeads([leads[3]], [liya], []).map((i) => i.issue), ["no-customer-record"]);
});

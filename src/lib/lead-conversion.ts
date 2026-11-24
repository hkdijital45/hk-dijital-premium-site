// Lead -> müşteri dönüşümü için saf (veritabanından bağımsız) eşleştirme ve denetim yardımcıları.
// Kural: İki işletme yalnızca ADI aynıysa aynı işletmedir. Telefon, e-posta, web sitesi veya
// işletme sahibi ortaklığı otomatik birleştirme nedeni DEĞİLDİR (aynı sahibin farklı işletmeleri ayrı müşteridir).

const TR_MAP: Record<string, string> = { "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g", "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c" };

export function normalizeBusinessName(value: unknown): string {
  return String(value ?? "")
    .replace(/[ıİşŞğĞüÜöÖçÇ]/g, (char) => TR_MAP[char] || char)
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isSameBusiness(a: unknown, b: unknown): boolean {
  const left = normalizeBusinessName(a);
  const right = normalizeBusinessName(b);
  return Boolean(left) && left === right;
}

type Row = Record<string, any>;

export const isInactiveCompany = (company: Row) => Boolean(company?.deleted_at || company?.archived_at) || ["Arşivli", "Silindi", "Pasif"].includes(String(company?.status || ""));

export type CompanyResolution =
  | { action: "reuse"; company: Row; reason: "source-customer" | "linked-company" | "same-name" }
  | { action: "create"; reason: "no-match" | "stale-link"; staleCompanyId?: string };

/**
 * Lead için hangi şirket kaydının kullanılacağını belirler.
 * Telefon/e-posta ile ASLA eşleştirmez.
 */
export function resolveConversionCompany(lead: Row, companies: Row[], customers: Row[]): CompanyResolution {
  const leadName = String(lead?.company || "").trim();
  const byId = new Map(companies.map((company) => [company.id, company]));
  const nameOk = (company: Row) => !leadName || isSameBusiness(company.name, leadName);

  // 1) Bu lead'den daha önce oluşmuş müşteri kaydı (mükerrer dönüşümü engeller) — yalnızca ad uyuyorsa.
  const sourceCustomer = customers.find((customer) => customer.source_lead_id === lead.id && byId.has(customer.company_id));
  const sourceCompany = sourceCustomer ? byId.get(sourceCustomer.company_id) : null;
  if (sourceCompany && !isInactiveCompany(sourceCompany) && nameOk(sourceCompany)) return { action: "reuse", company: sourceCompany, reason: "source-customer" };

  // 2) Lead'in bağlı olduğu şirket — yalnızca ad uyuyorsa güvenilir sayılır.
  const linked = lead?.company_id ? byId.get(lead.company_id) : null;
  if (linked && !isInactiveCompany(linked) && nameOk(linked)) return { action: "reuse", company: linked, reason: "linked-company" };

  // 3) Aynı adlı aktif şirket.
  if (leadName) {
    const sameName = companies.find((company) => !isInactiveCompany(company) && isSameBusiness(company.name, leadName));
    if (sameName) return { action: "reuse", company: sameName, reason: "same-name" };
  }

  const stale = linked || sourceCompany;
  return { action: "create", reason: stale ? "stale-link" : "no-match", staleCompanyId: stale?.id };
}

export type ConversionIssue = { leadId: string; leadName: string; issue: "no-company-link" | "company-missing" | "name-mismatch" | "no-customer-record"; companyId?: string; companyName?: string };

const CONVERTED = ["Kazanıldı", "Dönüştürüldü", "Müşteri Oldu"];
export const isConvertedLead = (lead: Row) => CONVERTED.includes(String(lead?.status || "")) || lead?.pipeline_stage === "Kazanıldı";

/** Salt okunur tutarlılık denetimi: dönüştürülmüş lead'lerin müşteri bağlantısını kontrol eder. */
export function auditConvertedLeads(leads: Row[], companies: Row[], customers: Row[]): ConversionIssue[] {
  const byId = new Map(companies.map((company) => [company.id, company]));
  const issues: ConversionIssue[] = [];
  for (const lead of leads) {
    if (lead.deleted_at || lead.archived_at || !isConvertedLead(lead)) continue;
    const base = { leadId: lead.id, leadName: String(lead.company || lead.name || "") };
    if (!lead.company_id) { issues.push({ ...base, issue: "no-company-link" }); continue; }
    const company = byId.get(lead.company_id);
    if (!company) { issues.push({ ...base, issue: "company-missing", companyId: lead.company_id }); continue; }
    if (String(lead.company || "").trim() && !isSameBusiness(company.name, lead.company)) { issues.push({ ...base, issue: "name-mismatch", companyId: company.id, companyName: company.name }); continue; }
    if (!customers.some((customer) => customer.company_id === company.id)) issues.push({ ...base, issue: "no-customer-record", companyId: company.id, companyName: company.name });
  }
  return issues;
}

/** Var olan müşteri kaydını yalnızca boş alanları doldurarak günceller; dolu verinin üzerine yazmaz. */
export function fillBlankFields(existing: Row, incoming: Row): Row {
  const patch: Row = {};
  for (const [key, value] of Object.entries(incoming)) {
    const current = existing?.[key];
    const empty = current === null || current === undefined || String(current).trim() === "";
    if (empty && value !== null && value !== undefined && String(value).trim() !== "") patch[key] = value;
  }
  return patch;
}

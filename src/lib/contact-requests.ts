// Website contact requests (contact_forms) and their conversion to the
// canonical Lead record. Pure helpers only: persistence and auth live in the
// API routes, which reuse the existing supabaseRest client.
export const CONTACT_REQUEST_STATUS = {
  new: "Yeni",
  reviewing: "İnceleniyor",
  converted: "Lead'e Dönüştürüldü",
  archived: "Arşivlendi",
  spam: "Spam"
} as const;

export type ContactRequestStatusKey = keyof typeof CONTACT_REQUEST_STATUS;
export const CONTACT_LEAD_SOURCE = "İletişim Formu";

export type ContactRequestRow = {
  id: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  source: string | null;
  status: string | null;
  created_at: string;
  updated_at?: string | null;
  converted_lead_id?: string | null;
  converted_at?: string | null;
};

export function statusKeyFor(status: string | null | undefined): ContactRequestStatusKey {
  const value = String(status ?? "").trim();
  const match = (Object.keys(CONTACT_REQUEST_STATUS) as ContactRequestStatusKey[]).find((key) => CONTACT_REQUEST_STATUS[key] === value);
  return match ?? "new";
}

export function isConverted(request: { status?: string | null; converted_lead_id?: string | null }): boolean {
  return statusKeyFor(request.status) === "converted" || Boolean(request.converted_lead_id);
}

export function normalizePhoneDigits(value: unknown): string {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  if (digits.length === 10) digits = `90${digits}`;
  return digits;
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("tr");
}

export function normalizeCompany(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("tr");
}

export type LeadConversionValues = {
  company: string;
  name: string;
  phone: string;
  email: string;
  message: string;
};

export function leadValuesFromRequest(request: ContactRequestRow): LeadConversionValues {
  return {
    company: String(request.company ?? "").trim(),
    name: String(request.name ?? "").trim(),
    phone: normalizePhoneDigits(request.phone),
    email: normalizeEmail(request.email),
    message: String(request.message ?? "").trim()
  };
}

// The canonical lead insert payload. Source is the existing lead convention for
// website contact forms, so it stays reportable next to historical leads.
export function leadInsertPayload(values: LeadConversionValues) {
  return {
    source: CONTACT_LEAD_SOURCE,
    name: values.name,
    company: values.company,
    phone: values.phone,
    email: values.email,
    message: values.message,
    status: "Yeni"
  };
}

export function validateConversionValues(input: unknown): { ok: true; values: LeadConversionValues } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Geçersiz istek." };
  const body = input as Record<string, unknown>;
  const values: LeadConversionValues = {
    company: String(body.company ?? "").trim().slice(0, 200),
    name: String(body.name ?? "").trim().slice(0, 200),
    phone: normalizePhoneDigits(body.phone).slice(0, 20),
    email: normalizeEmail(body.email).slice(0, 200),
    message: String(body.message ?? "").trim().slice(0, 5000)
  };
  if (!values.company && !values.name) return { ok: false, error: "Firma veya ad soyad zorunludur." };
  if (!values.email && values.phone.length < 10) return { ok: false, error: "Geçerli bir telefon veya e-posta gerekir." };
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return { ok: false, error: "E-posta adresi geçersiz." };
  return { ok: true, values };
}

export type LeadCandidate = { id: string; company?: string | null; name?: string | null; phone?: string | null; email?: string | null; status?: string | null; deleted_at?: string | null };
export type DuplicateMatch = { leadId: string; company: string; name: string; status: string; reasons: Array<"telefon" | "e-posta" | "firma"> };

// Priority matching only: normalized phone, normalized email, normalized company.
// No fuzzy matching; a match is a warning for the admin, never a silent merge.
export function findDuplicateLeads(values: LeadConversionValues, candidates: LeadCandidate[]): DuplicateMatch[] {
  const phone = normalizePhoneDigits(values.phone);
  const email = normalizeEmail(values.email);
  const company = normalizeCompany(values.company);
  const matches: DuplicateMatch[] = [];
  for (const lead of candidates) {
    if (lead.deleted_at) continue;
    const reasons: DuplicateMatch["reasons"] = [];
    if (phone && normalizePhoneDigits(lead.phone) === phone) reasons.push("telefon");
    if (email && normalizeEmail(lead.email) === email) reasons.push("e-posta");
    if (company && normalizeCompany(lead.company) === company) reasons.push("firma");
    if (reasons.length) matches.push({ leadId: lead.id, company: lead.company || "", name: lead.name || "", status: lead.status || "", reasons });
  }
  return matches;
}

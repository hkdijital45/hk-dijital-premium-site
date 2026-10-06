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
  read_at?: string | null;
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

// Read state (contact_forms.read_at) is independent of workflow status. Opening
// a request, or bulk-marking it read, never changes status.
export function isUnreadRequest(row: { read_at?: string | null }): boolean {
  return !row.read_at;
}

export function unreadContactRequestCount(rows: Array<{ read_at?: string | null }>): number {
  return rows.filter(isUnreadRequest).length;
}

const APPLICATION_DATE = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "long", year: "numeric" });
const APPLICATION_TIME = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hour12: false });

// Original application time (created_at), Europe/Istanbul, same timezone rule as
// formatReportTimestamp. Never updated_at, read_at, converted_at or "now".
export function formatApplicationParts(value: string | Date | null | undefined): { date: string; time: string } {
  if (!value) return { date: "Tarih bilgisi yok", time: "" };
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return { date: "Tarih bilgisi yok", time: "" };
  return { date: APPLICATION_DATE.format(date), time: APPLICATION_TIME.format(date) };
}

export function formatApplicationDateTime(value: string | Date | null | undefined): string {
  const { date, time } = formatApplicationParts(value);
  return time ? `${date} • ${time}` : date;
}

export const CONTACT_BULK_ACTIONS = ["mark_read", "mark_unread", "mark_all_read", "review", "archive", "spam", "delete"] as const;
export type ContactBulkAction = (typeof CONTACT_BULK_ACTIONS)[number];
const BULK_MAX_IDS = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseBulkRequest(input: unknown): { ok: true; action: ContactBulkAction; ids: string[] } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Geçersiz istek." };
  const body = input as Record<string, unknown>;
  const action = String(body.action ?? "") as ContactBulkAction;
  if (!CONTACT_BULK_ACTIONS.includes(action)) return { ok: false, error: "Geçersiz işlem." };
  if (action === "mark_all_read") return { ok: true, action, ids: [] };
  if (!Array.isArray(body.ids)) return { ok: false, error: "Talep listesi gönderilmedi." };
  const ids = [...new Set(body.ids.map((id) => String(id)))];
  if (!ids.length) return { ok: false, error: "En az bir talep seçin." };
  if (ids.length > BULK_MAX_IDS) return { ok: false, error: `Tek seferde en fazla ${BULK_MAX_IDS} talep işlenebilir.` };
  if (!ids.every((id) => UUID_PATTERN.test(id))) return { ok: false, error: "Geçersiz talep kimliği." };
  return { ok: true, action, ids };
}

export type ContactBulkPlan = { method: "PATCH" | "DELETE"; path: string; body?: Record<string, unknown> };

// Set-based PostgREST plans against contact_forms only. Status changes never
// touch converted requests, and no plan ever references the leads table.
export function buildBulkPlan(action: ContactBulkAction, ids: string[], nowIso: string): ContactBulkPlan {
  const inList = `id=in.(${ids.join(",")})`;
  const notConverted = `converted_lead_id=is.null&status=neq.${encodeURIComponent(CONTACT_REQUEST_STATUS.converted)}`;
  const returning = "select=id,status,read_at,converted_lead_id,converted_at";
  switch (action) {
    case "mark_read":
      return { method: "PATCH", path: `contact_forms?${inList}&read_at=is.null&${returning}`, body: { read_at: nowIso } };
    case "mark_unread":
      return { method: "PATCH", path: `contact_forms?${inList}&read_at=not.is.null&${returning}`, body: { read_at: null } };
    case "mark_all_read":
      return { method: "PATCH", path: `contact_forms?read_at=is.null&${returning}`, body: { read_at: nowIso } };
    case "review":
      return { method: "PATCH", path: `contact_forms?${inList}&${notConverted}&${returning}`, body: { status: CONTACT_REQUEST_STATUS.reviewing, updated_at: nowIso } };
    case "archive":
      return { method: "PATCH", path: `contact_forms?${inList}&${notConverted}&${returning}`, body: { status: CONTACT_REQUEST_STATUS.archived, updated_at: nowIso } };
    case "spam":
      return { method: "PATCH", path: `contact_forms?${inList}&${notConverted}&${returning}`, body: { status: CONTACT_REQUEST_STATUS.spam, updated_at: nowIso } };
    case "delete":
      return { method: "DELETE", path: `contact_forms?${inList}&select=id` };
  }
}

// Derived notifications for unread, still-open website requests. The id prefix
// keeps them in the existing Bildirim Merkezi read/archive state.
export function contactRequestNotifications(rows: ContactRequestRow[], limit = 5) {
  const pending = rows
    .filter((row) => isUnreadRequest(row) && !isConverted(row) && ["new", "reviewing"].includes(statusKeyFor(row.status)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const items = pending.slice(0, limit).map((row) => {
    const title = row.company || row.name || "İsimsiz talep";
    const applied = formatApplicationDateTime(row.created_at);
    return {
      id: `contact-request-${row.id}`,
      label: "Yeni İletişim Talebi",
      text: `${title} web sitesi üzerinden iletişim formu gönderdi.`,
      appliedAt: applied,
      time: "",
      tone: "red",
      target: "Gelen Talepler",
      href: `/hk-admin/gelen-talepler?request=${encodeURIComponent(row.id)}`,
      source: CONTACT_LEAD_SOURCE
    };
  });
  if (pending.length > limit) {
    items.push({
      id: `contact-requests-more-${pending.length - limit}`,
      label: "Diğer iletişim talepleri",
      text: `${pending.length - limit} okunmamış web sitesi talebi daha bekliyor.`,
      appliedAt: "",
      time: "",
      tone: "cyan",
      target: "Gelen Talepler",
      href: "/hk-admin/gelen-talepler",
      source: CONTACT_LEAD_SOURCE
    });
  }
  return items;
}

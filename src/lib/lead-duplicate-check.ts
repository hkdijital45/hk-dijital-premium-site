// Manual lead duplicate check — normalized phone / Instagram handle /
// website domain / name+district comparison against the existing
// public.leads table (no second lead store, no new matching service).
// Exact/high-confidence match on phone, Instagram, or domain blocks
// creation outright (409); a weak name+district match is reported but
// never blocks — matches the task's "do not produce false positives"
// requirement.
import "server-only";
import { supabaseRest } from "@/lib/supabase";

export function normalizePhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  // Turkish numbers: drop a leading country code (90) or trunk prefix (0)
  // so "+905xx...", "905xx...", "05xx...", and "5xx..." all normalize to
  // the same bare subscriber number before comparing.
  return digits.replace(/^90/, "").replace(/^0/, "");
}

export function normalizeInstagram(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLocaleLowerCase("en").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/^@/, "").replace(/\/.*$/, "").replace(/\?.*$/, "");
}

export function normalizeDomain(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toLocaleLowerCase("en").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
}

function normalizeName(value: string | null | undefined): string {
  return (value || "").trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
}

export type LeadDuplicateMatch = { id: string; company: string | null; name: string | null; source: string | null; status: string | null; matchedOn: "phone" | "instagram" | "domain" | "name_district" };

export type LeadDuplicateCheckResult = { exactMatch: LeadDuplicateMatch | null; possibleMatches: LeadDuplicateMatch[] };

/** Read-only check — never writes. Callers decide what to do with the
 * result (block on exactMatch, just surface possibleMatches). */
export async function checkLeadDuplicate(input: {
  phone?: string | null; instagram?: string | null; website?: string | null; company?: string | null; district?: string | null;
}): Promise<LeadDuplicateCheckResult> {
  const phone = normalizePhone(input.phone);
  const instagram = normalizeInstagram(input.instagram);
  const domain = normalizeDomain(input.website);
  const name = normalizeName(input.company);
  const district = normalizeName(input.district);

  if (!phone && !instagram && !domain && !name) return { exactMatch: null, possibleMatches: [] };

  const candidates = await supabaseRest<Array<{ id: string; company: string | null; name: string | null; source: string | null; status: string | null; phone: string | null; instagram: string | null; website: string | null; district: string | null; deleted_at: string | null }>>(
    `leads?select=id,company,name,source,status,phone,instagram,website,district,deleted_at&deleted_at=is.null&limit=2000`
  ).catch(() => []);

  let exactMatch: LeadDuplicateMatch | null = null;
  const possibleMatches: LeadDuplicateMatch[] = [];

  for (const row of candidates) {
    const toMatch = (matchedOn: LeadDuplicateMatch["matchedOn"]): LeadDuplicateMatch => ({ id: row.id, company: row.company, name: row.name, source: row.source, status: row.status, matchedOn });
    if (phone && normalizePhone(row.phone) === phone) { exactMatch = toMatch("phone"); break; }
    if (instagram && normalizeInstagram(row.instagram) === instagram) { exactMatch = toMatch("instagram"); break; }
    if (domain && normalizeDomain(row.website) === domain) { exactMatch = toMatch("domain"); break; }
  }

  if (!exactMatch && name) {
    for (const row of candidates) {
      if (normalizeName(row.company) === name && (!district || normalizeName(row.district) === district)) {
        possibleMatches.push({ id: row.id, company: row.company, name: row.name, source: row.source, status: row.status, matchedOn: "name_district" });
      }
    }
  }

  return { exactMatch, possibleMatches: possibleMatches.slice(0, 5) };
}

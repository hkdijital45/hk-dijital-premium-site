import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import {
  CONTACT_REQUEST_STATUS, findDuplicateLeads, isConverted, leadInsertPayload, leadValuesFromRequest, normalizeEmail,
  normalizePhoneDigits, validateConversionValues, type ContactRequestRow, type LeadCandidate
} from "@/lib/contact-requests";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONVERTED = CONTACT_REQUEST_STATUS.converted;

async function requestById(id: string): Promise<ContactRequestRow | null> {
  const [row] = await supabaseRest<ContactRequestRow[]>(`contact_forms?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
  return row ?? null;
}

// Likely matches only: exact normalized phone variants, exact email and exact
// company (case-insensitive). The pure matcher makes the final decision.
async function duplicateCandidates(values: ReturnType<typeof leadValuesFromRequest>): Promise<LeadCandidate[]> {
  const digits = normalizePhoneDigits(values.phone);
  const variants = digits.startsWith("90") ? [digits, `0${digits.slice(2)}`, digits.slice(2)] : [digits];
  const queries: string[] = [];
  if (digits.length >= 10) queries.push(`leads?phone=in.(${variants.join(",")})&select=id,company,name,phone,email,status,deleted_at&limit=20`);
  if (values.email) queries.push(`leads?email=ilike.${encodeURIComponent(normalizeEmail(values.email))}&select=id,company,name,phone,email,status,deleted_at&limit=20`);
  if (values.company) queries.push(`leads?company=ilike.${encodeURIComponent(values.company)}&select=id,company,name,phone,email,status,deleted_at&limit=20`);
  const results = await Promise.all(queries.map((query) => supabaseRest<LeadCandidate[]>(query).catch(() => [])));
  const byId = new Map<string, LeadCandidate>();
  for (const list of results) for (const lead of list ?? []) byId.set(lead.id, lead);
  return [...byId.values()];
}

// A request can only be converted once the converted_lead_id column exists.
async function conversionSchemaReady(): Promise<boolean> {
  return supabaseRest("contact_forms?select=converted_lead_id&limit=1").then(() => true).catch(() => false);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("gelen-talepler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Geçersiz talep." }, { status: 400 });
  try {
    const row = await requestById(id);
    if (!row) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
    if (isConverted(row)) return NextResponse.json({ alreadyConverted: true, leadId: row.converted_lead_id ?? null, values: null, duplicates: [] });
    const values = leadValuesFromRequest(row);
    const duplicates = findDuplicateLeads(values, await duplicateCandidates(values));
    return NextResponse.json({ alreadyConverted: false, leadId: null, values, duplicates });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("gelen-talepler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Geçersiz talep." }, { status: 400 });
  const body = await request.json().catch(() => null) as { values?: unknown; allowDuplicate?: unknown } | null;
  const checked = validateConversionValues(body?.values);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  if (!(await conversionSchemaReady())) {
    return NextResponse.json({ error: "Dönüştürme için veritabanı güncellemesi gerekli." }, { status: 503 });
  }
  try {
    const row = await requestById(id);
    if (!row) return NextResponse.json({ error: "Talep bulunamadı." }, { status: 404 });
    if (isConverted(row)) return NextResponse.json({ error: "Bu talep zaten Lead'e dönüştürüldü.", leadId: row.converted_lead_id ?? null }, { status: 409 });

    if (body?.allowDuplicate !== true) {
      const duplicates = findDuplicateLeads(checked.values, await duplicateCandidates(checked.values));
      if (duplicates.length) return NextResponse.json({ error: "Bu iletişim bilgileriyle eşleşen mevcut bir Lead bulundu.", duplicates }, { status: 409 });
    }

    // Claim the request first: only one concurrent conversion can flip it.
    const claimed = await supabaseRest<ContactRequestRow[]>(
      `contact_forms?id=eq.${encodeURIComponent(id)}&converted_lead_id=is.null&status=neq.${encodeURIComponent(CONVERTED)}`,
      { method: "PATCH", body: JSON.stringify({ status: CONVERTED, updated_at: new Date().toISOString() }) }
    );
    if (!claimed?.length) return NextResponse.json({ error: "Bu talep zaten dönüştürülüyor veya dönüştürüldü." }, { status: 409 });

    const restore = () => supabaseRest(`contact_forms?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: row.status || CONTACT_REQUEST_STATUS.new, converted_lead_id: null, converted_at: null })
    }).catch(() => null);

    let leadId: string;
    try {
      const [lead] = await supabaseRest<Array<{ id: string }>>("leads", { method: "POST", body: JSON.stringify(leadInsertPayload(checked.values)) });
      leadId = lead.id;
    } catch (error) {
      await restore();
      return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
    }

    try {
      await supabaseRest(`contact_forms?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ converted_lead_id: leadId, converted_at: new Date().toISOString() })
      });
    } catch {
      // Keep request and lead consistent: remove the lead created moments ago and restore the request.
      await supabaseRest(`leads?id=eq.${encodeURIComponent(leadId)}`, { method: "DELETE" }).catch(() => null);
      await restore();
      return NextResponse.json({ error: "Lead oluşturuldu ancak talep bağlanamadı. Lütfen tekrar deneyin." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, leadId });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title }, { status: 500 });
  }
}

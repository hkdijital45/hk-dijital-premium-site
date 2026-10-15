import "server-only";

import { supabaseRest } from "@/lib/supabase";
import {
  BUSINESS_RELATIONSHIPS_TABLE,
  BUSINESS_UNITS_TABLE,
  BusinessRelationshipValidationError,
  buildRelationshipRow,
  isDuplicatePair,
  otherSideOf,
  sanitizeUnitInput,
  type BusinessEntityRef,
  type BusinessRelationshipRecord,
  type BusinessUnitRecord,
  type LinkedBusiness,
  type RelationshipType
} from "@/lib/business-relationships-shared";

// Server-only store for İşletme ve Şube Yönetimi. Every write verifies the
// referenced lead/customer/business_unit really exists first; unlinking
// only ever deletes the relationship row, never a business record.

export class BusinessRelationshipNotFoundError extends Error {}

type LeadLite = { id: string; company: string | null; name: string | null; instagram: string | null; website: string | null; phone: string | null; address: string | null; company_id: string | null };
type CompanyLite = { id: string; name: string | null; instagram: string | null; website: string | null; phone: string | null };

const LEAD_SELECT = "id,company,name,instagram,website,phone,address,company_id";
const COMPANY_SELECT = "id,name,instagram,website,phone";
const UNIT_SELECT = "id,unit_kind,name,business_name,instagram,website,phone,address,city,description,created_at,updated_at,archived_at";

function inList(ids: string[]) {
  return `(${ids.map(encodeURIComponent).join(",")})`;
}

async function fetchLeads(ids: string[]): Promise<LeadLite[]> {
  if (!ids.length) return [];
  return supabaseRest<LeadLite[]>(`leads?select=${LEAD_SELECT}&id=in.${inList(ids)}&deleted_at=is.null`);
}

async function fetchCompanies(ids: string[]): Promise<CompanyLite[]> {
  if (!ids.length) return [];
  return supabaseRest<CompanyLite[]>(`companies?select=${COMPANY_SELECT}&id=in.${inList(ids)}`);
}

async function fetchUnits(ids: string[]): Promise<BusinessUnitRecord[]> {
  if (!ids.length) return [];
  return supabaseRest<BusinessUnitRecord[]>(`${BUSINESS_UNITS_TABLE}?select=${UNIT_SELECT}&id=in.${inList(ids)}&archived_at=is.null`);
}

export async function entityExists(ref: BusinessEntityRef): Promise<boolean> {
  if (ref.type === "lead") return (await fetchLeads([ref.id])).length > 0;
  if (ref.type === "company") return (await fetchCompanies([ref.id])).length > 0;
  return (await fetchUnits([ref.id])).length > 0;
}

async function requireEntity(ref: BusinessEntityRef) {
  if (!(await entityExists(ref))) throw new BusinessRelationshipNotFoundError("İşletme bulunamadı veya silinmiş.");
}

/** The ids that represent "this business": a lead also counts as its
 * converted customer (and a customer as every lead converted into it), so
 * branches/brands added before conversion stay visible afterwards. */
export async function resolveSelfIds(ref: BusinessEntityRef): Promise<string[]> {
  if (ref.type === "lead") {
    const [lead] = await fetchLeads([ref.id]);
    return lead?.company_id ? [ref.id, lead.company_id] : [ref.id];
  }
  if (ref.type === "company") {
    const leads = await supabaseRest<Array<{ id: string }>>(`leads?select=id&company_id=eq.${encodeURIComponent(ref.id)}&deleted_at=is.null&limit=50`);
    return [ref.id, ...leads.map((lead) => lead.id)];
  }
  return [ref.id];
}

async function relationshipsTouching(ids: string[]): Promise<BusinessRelationshipRecord[]> {
  if (!ids.length) return [];
  const list = inList(ids);
  const or = ["parent_lead_id", "parent_company_id", "parent_unit_id", "child_lead_id", "child_company_id", "child_unit_id"].map((column) => `${column}.in.${list}`).join(",");
  return supabaseRest<BusinessRelationshipRecord[]>(`${BUSINESS_RELATIONSHIPS_TABLE}?select=*&or=(${or})&order=created_at.asc&limit=200`);
}

export async function listLinkedBusinesses(ref: BusinessEntityRef): Promise<LinkedBusiness[]> {
  const selfIds = await resolveSelfIds(ref);
  const rows = await relationshipsTouching(selfIds);
  const sides = rows.map((row) => ({ row, side: otherSideOf(row, selfIds) })).filter((item) => item.side && !selfIds.includes(item.side.entity.id));
  const idsOf = (type: string) => sides.filter((item) => item.side!.entity.type === type).map((item) => item.side!.entity.id);
  const [leads, companies, units] = await Promise.all([fetchLeads(idsOf("lead")), fetchCompanies(idsOf("company")), fetchUnits(idsOf("unit"))]);

  const result: LinkedBusiness[] = [];
  for (const { row, side } of sides) {
    const entity = side!.entity;
    const base = { relationshipId: row.id, relationshipType: row.relationship_type, direction: side!.direction, entity };
    if (entity.type === "lead") {
      const lead = leads.find((item) => item.id === entity.id);
      if (lead) result.push({ ...base, name: lead.company || lead.name || "İsimsiz lead", instagram: lead.instagram, website: lead.website, phone: lead.phone, address: lead.address, description: null });
    } else if (entity.type === "company") {
      const company = companies.find((item) => item.id === entity.id);
      if (company) result.push({ ...base, name: company.name || "İsimsiz müşteri", instagram: company.instagram, website: company.website, phone: company.phone, address: null, description: null });
    } else {
      const unit = units.find((item) => item.id === entity.id);
      if (unit) result.push({ ...base, name: unit.name, instagram: unit.instagram, website: unit.website, phone: unit.phone, address: unit.address, description: unit.description });
    }
  }
  return result;
}

async function insertRelationship(parent: BusinessEntityRef, child: BusinessEntityRef, relationshipType: RelationshipType, createdBy: string | null, notes = ""): Promise<BusinessRelationshipRecord> {
  const row = buildRelationshipRow(parent, child, relationshipType, notes);
  const existing = await relationshipsTouching([parent.id]);
  if (isDuplicatePair(existing, parent, child)) throw new BusinessRelationshipValidationError("Bu işletmeler zaten birbirine bağlı.");
  const [created] = await supabaseRest<BusinessRelationshipRecord[]>(BUSINESS_RELATIONSHIPS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...row, created_by: createdBy })
  });
  return created;
}

/** "+ Şube Ekle" / "+ Bağlı Marka Ekle": creates a new business identity and
 * links it under `parent` with the user-chosen relationship type. */
export async function createUnitAndLink(parent: BusinessEntityRef, relationshipType: RelationshipType, input: Record<string, unknown>, createdBy: string | null) {
  const fields = sanitizeUnitInput(input, true);
  await requireEntity(parent);
  const [unit] = await supabaseRest<BusinessUnitRecord[]>(BUSINESS_UNITS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...fields, unit_kind: relationshipType, created_by: createdBy })
  });
  try {
    const relationship = await insertRelationship(parent, { type: "unit", id: unit.id }, relationshipType, createdBy);
    return { unit, relationship };
  } catch (error) {
    // The unit was created by this same request and is not linked anywhere
    // yet — archive it so a failed link never leaves a dangling business.
    await supabaseRest(`${BUSINESS_UNITS_TABLE}?id=eq.${unit.id}`, { method: "PATCH", body: JSON.stringify({ archived_at: new Date().toISOString() }) }).catch(() => null);
    throw error;
  }
}

/** "Mevcut İşletmeyi Bağla": links two existing records without copying either. */
export async function linkExisting(parent: BusinessEntityRef, child: BusinessEntityRef, relationshipType: RelationshipType, createdBy: string | null) {
  await Promise.all([requireEntity(parent), requireEntity(child)]);
  return insertRelationship(parent, child, relationshipType, createdBy);
}

/** Removes only the link. The lead/customer/business_unit stays. */
export async function unlinkRelationship(relationshipId: string) {
  const rows = await supabaseRest<BusinessRelationshipRecord[]>(`${BUSINESS_RELATIONSHIPS_TABLE}?id=eq.${encodeURIComponent(relationshipId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" }
  });
  if (!rows.length) throw new BusinessRelationshipNotFoundError("İlişki bulunamadı.");
  return rows[0];
}

export async function updateRelationshipType(relationshipId: string, relationshipType: RelationshipType) {
  const rows = await supabaseRest<BusinessRelationshipRecord[]>(`${BUSINESS_RELATIONSHIPS_TABLE}?id=eq.${encodeURIComponent(relationshipId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ relationship_type: relationshipType })
  });
  if (!rows.length) throw new BusinessRelationshipNotFoundError("İlişki bulunamadı.");
  return rows[0];
}

export async function getBusinessUnit(id: string): Promise<BusinessUnitRecord> {
  const [unit] = await fetchUnits([id]);
  if (!unit) throw new BusinessRelationshipNotFoundError("İşletme bulunamadı.");
  return unit;
}

export async function updateBusinessUnit(id: string, input: Record<string, unknown>) {
  const fields = sanitizeUnitInput(input, false);
  if (!Object.keys(fields).length) throw new BusinessRelationshipValidationError("Güncellenecek alan yok.");
  const rows = await supabaseRest<BusinessUnitRecord[]>(`${BUSINESS_UNITS_TABLE}?id=eq.${encodeURIComponent(id)}&archived_at=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(fields)
  });
  if (!rows.length) throw new BusinessRelationshipNotFoundError("İşletme bulunamadı.");
  return rows[0];
}

/** BAĞIMSIZ mode: businesses that are neither a lead nor a customer. */
export async function listIndependentUnits(): Promise<BusinessUnitRecord[]> {
  return supabaseRest<BusinessUnitRecord[]>(`${BUSINESS_UNITS_TABLE}?select=${UNIT_SELECT}&unit_kind=eq.independent&archived_at=is.null&order=name.asc&limit=200`);
}

export async function createIndependentUnit(input: Record<string, unknown>, createdBy: string | null): Promise<BusinessUnitRecord> {
  const fields = sanitizeUnitInput(input, true);
  const [unit] = await supabaseRest<BusinessUnitRecord[]>(BUSINESS_UNITS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...fields, unit_kind: "independent", created_by: createdBy })
  });
  return unit;
}

export type BusinessSearchResult = { entity: BusinessEntityRef; name: string; detail: string };

function ilike(query: string) {
  return encodeURIComponent(`*${query.replace(/[*,()]/g, " ").trim()}*`);
}

/** Search for "Mevcut İşletmeyi Bağla" across leads, customers and business units. */
export async function searchBusinesses(query: string): Promise<BusinessSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const pattern = ilike(q);
  const [leads, companies, units] = await Promise.all([
    supabaseRest<LeadLite[]>(`leads?select=${LEAD_SELECT}&deleted_at=is.null&or=(company.ilike.${pattern},name.ilike.${pattern},instagram.ilike.${pattern})&limit=8`),
    supabaseRest<CompanyLite[]>(`companies?select=${COMPANY_SELECT}&or=(name.ilike.${pattern},instagram.ilike.${pattern})&limit=8`),
    supabaseRest<BusinessUnitRecord[]>(`${BUSINESS_UNITS_TABLE}?select=${UNIT_SELECT}&archived_at=is.null&or=(name.ilike.${pattern},instagram.ilike.${pattern})&limit=8`)
  ]);
  return [
    ...leads.map((lead) => ({ entity: { type: "lead" as const, id: lead.id }, name: lead.company || lead.name || "İsimsiz lead", detail: ["Lead", lead.instagram].filter(Boolean).join(" · ") })),
    ...companies.map((company) => ({ entity: { type: "company" as const, id: company.id }, name: company.name || "İsimsiz müşteri", detail: ["Müşteri", company.instagram].filter(Boolean).join(" · ") })),
    ...units.map((unit) => ({ entity: { type: "unit" as const, id: unit.id }, name: unit.name, detail: ["İşletme", unit.instagram].filter(Boolean).join(" · ") }))
  ];
}

/** Server-side ownership check for report attribution: `unitId` must be a
 * business_unit directly linked to `owner` (or `owner` itself is that
 * unit in BAĞIMSIZ mode). Prevents attributing a report to another
 * business's branch/brand by passing an arbitrary id. */
export async function assertUnitLinkedTo(unitId: string, owner: BusinessEntityRef | null): Promise<void> {
  await getBusinessUnit(unitId);
  if (!owner) return;
  if (owner.type === "unit" && owner.id === unitId) return;
  const linked = await listLinkedBusinesses(owner);
  if (!linked.some((item) => item.entity.type === "unit" && item.entity.id === unitId)) {
    throw new BusinessRelationshipValidationError("Seçilen işletme bu lead/müşteriye bağlı değil.");
  }
}

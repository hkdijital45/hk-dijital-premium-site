// İşletme ve Şube Yönetimi — types and pure validation shared by the API
// routes, the server-side store (business-relationships.ts), client
// components and unit tests. No Supabase access here.

export const BUSINESS_UNITS_TABLE = "business_units";
export const BUSINESS_RELATIONSHIPS_TABLE = "business_relationships";

export const RELATIONSHIP_TYPES = ["branch", "related_brand", "business_group"] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const UNIT_KINDS = ["branch", "related_brand", "business_group", "independent"] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export const ENTITY_TYPES = ["lead", "company", "unit"] as const;
export type BusinessEntityType = (typeof ENTITY_TYPES)[number];

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  branch: "Şube",
  related_brand: "Bağlı Marka",
  business_group: "İşletme Grubu"
};

export const ENTITY_TYPE_LABELS: Record<BusinessEntityType, string> = {
  lead: "Lead",
  company: "Müşteri",
  unit: "İşletme"
};

export type BusinessEntityRef = { type: BusinessEntityType; id: string };

export type BusinessUnitRecord = {
  id: string;
  unit_kind: UnitKind;
  name: string;
  business_name: string | null;
  instagram: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type BusinessRelationshipRecord = {
  id: string;
  relationship_type: RelationshipType;
  parent_lead_id: string | null;
  parent_company_id: string | null;
  parent_unit_id: string | null;
  child_lead_id: string | null;
  child_company_id: string | null;
  child_unit_id: string | null;
  notes: string;
  created_at: string;
};

/** One business shown in Lead Merkezi / Reklam Doktoru Pro: the linked
 * business itself plus how it relates to the business being viewed. */
export type LinkedBusiness = {
  relationshipId: string;
  relationshipType: RelationshipType;
  /** "child" = linked under the viewed business, "parent" = the viewed business is linked under it. */
  direction: "child" | "parent";
  entity: BusinessEntityRef;
  name: string;
  instagram: string | null;
  website: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
};

export const UNIT_EDITABLE_FIELDS = ["name", "business_name", "instagram", "website", "phone", "address", "city", "description"] as const;
export type BusinessUnitInput = Partial<Record<(typeof UNIT_EDITABLE_FIELDS)[number], string>>;

export class BusinessRelationshipValidationError extends Error {}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function isRelationshipType(value: unknown): value is RelationshipType {
  return typeof value === "string" && (RELATIONSHIP_TYPES as readonly string[]).includes(value);
}

export function parseEntityRef(type: unknown, id: unknown): BusinessEntityRef {
  if (typeof type !== "string" || !(ENTITY_TYPES as readonly string[]).includes(type)) throw new BusinessRelationshipValidationError("Geçersiz işletme türü.");
  if (!isUuid(id)) throw new BusinessRelationshipValidationError("Geçersiz işletme kimliği.");
  return { type: type as BusinessEntityType, id };
}

const MAX_FIELD_LENGTH: Record<string, number> = { description: 2000, address: 500 };

/** Trims, length-limits and normalizes a unit form. `requireName` is true
 * on create; on edit only the provided keys are returned. Unknown keys are
 * dropped, never written. */
export function sanitizeUnitInput(input: Record<string, unknown>, requireName: boolean): BusinessUnitInput {
  const out: BusinessUnitInput = {};
  for (const key of UNIT_EDITABLE_FIELDS) {
    if (!(key in input)) continue;
    const raw = input[key];
    if (raw !== null && raw !== undefined && typeof raw !== "string") throw new BusinessRelationshipValidationError(`Geçersiz alan: ${key}`);
    let value = String(raw ?? "").trim();
    const max = MAX_FIELD_LENGTH[key] || 200;
    if (value.length > max) throw new BusinessRelationshipValidationError(`${key} en fazla ${max} karakter olabilir.`);
    if (key === "instagram") value = normalizeInstagram(value);
    out[key] = value;
  }
  if (requireName && !out.name) throw new BusinessRelationshipValidationError("İşletme/şube adı zorunludur.");
  if ("name" in out && !out.name) throw new BusinessRelationshipValidationError("İşletme/şube adı boş olamaz.");
  return out;
}

/** "@robotik45", "robotik45", "https://instagram.com/robotik45/" -> "@robotik45". */
export function normalizeInstagram(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const fromUrl = trimmed.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const handle = (fromUrl ? fromUrl[1] : trimmed).replace(/^@+/, "").replace(/\/+$/, "");
  return handle ? `@${handle}` : "";
}

export function columnFor(side: "parent" | "child", ref: BusinessEntityRef): string {
  return `${side}_${ref.type === "unit" ? "unit" : ref.type}_id`;
}

export function refsEqual(a: BusinessEntityRef, b: BusinessEntityRef): boolean {
  return a.type === b.type && a.id === b.id;
}

/** Builds the insert row for a relationship, rejecting self-links. */
export function buildRelationshipRow(parent: BusinessEntityRef, child: BusinessEntityRef, relationshipType: RelationshipType, notes = "") {
  if (refsEqual(parent, child) || parent.id === child.id) throw new BusinessRelationshipValidationError("Bir işletme kendisine bağlanamaz.");
  if (!isRelationshipType(relationshipType)) throw new BusinessRelationshipValidationError("Geçersiz ilişki türü.");
  return {
    relationship_type: relationshipType,
    parent_lead_id: null,
    parent_company_id: null,
    parent_unit_id: null,
    child_lead_id: null,
    child_company_id: null,
    child_unit_id: null,
    [columnFor("parent", parent)]: parent.id,
    [columnFor("child", child)]: child.id,
    notes: notes.slice(0, 1000)
  } as Record<string, string | null>;
}

export function relationshipParent(row: BusinessRelationshipRecord): BusinessEntityRef {
  if (row.parent_lead_id) return { type: "lead", id: row.parent_lead_id };
  if (row.parent_company_id) return { type: "company", id: row.parent_company_id };
  return { type: "unit", id: row.parent_unit_id as string };
}

export function relationshipChild(row: BusinessRelationshipRecord): BusinessEntityRef {
  if (row.child_lead_id) return { type: "lead", id: row.child_lead_id };
  if (row.child_company_id) return { type: "company", id: row.child_company_id };
  return { type: "unit", id: row.child_unit_id as string };
}

/** True when this relationship already links these two businesses, in
 * either direction — mirrors the database's pair unique index so the API
 * can return a friendly message before the insert fails. */
export function isDuplicatePair(rows: BusinessRelationshipRecord[], a: BusinessEntityRef, b: BusinessEntityRef): boolean {
  return rows.some((row) => {
    const p = relationshipParent(row);
    const c = relationshipChild(row);
    return (p.id === a.id && c.id === b.id) || (p.id === b.id && c.id === a.id);
  });
}

/** For a viewed business, return the "other side" of each relationship that
 * touches any of `selfIds` (a lead's own id plus its converted company id). */
export function otherSideOf(row: BusinessRelationshipRecord, selfIds: string[]): { entity: BusinessEntityRef; direction: "child" | "parent" } | null {
  const parent = relationshipParent(row);
  const child = relationshipChild(row);
  if (selfIds.includes(parent.id)) return { entity: child, direction: "child" };
  if (selfIds.includes(child.id)) return { entity: parent, direction: "parent" };
  return null;
}

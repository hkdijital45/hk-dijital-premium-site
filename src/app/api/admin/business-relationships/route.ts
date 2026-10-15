import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity-log";
import {
  BusinessRelationshipNotFoundError,
  createIndependentUnit,
  createUnitAndLink,
  linkExisting,
  listIndependentUnits,
  listLinkedBusinesses,
  searchBusinesses,
  unlinkRelationship,
  updateBusinessUnit,
  updateRelationshipType
} from "@/lib/business-relationships";
import { BusinessRelationshipValidationError, isRelationshipType, isUuid, parseEntityRef } from "@/lib/business-relationships-shared";

// İşletme ve Şube Yönetimi API — used by Lead Merkezi's lead detail,
// Müşteri Yönetimi and Reklam Doktoru Pro's business selector.
async function requireBusinessAccess() {
  return (await requireModuleAccess("crm")) || (await requireModuleAccess("leads")) || (await requireModuleAccess("ad-insights")) || (await requireModuleAccess("musteriler"));
}

function errorResponse(error: unknown) {
  if (error instanceof BusinessRelationshipValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof BusinessRelationshipNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  const message = error instanceof Error ? error.message : "";
  if (message.includes("23505") || message.includes("business_relationships_pair_uidx")) return NextResponse.json({ error: "Bu işletmeler zaten birbirine bağlı." }, { status: 409 });
  if (message.includes("business_relationships_not_self")) return NextResponse.json({ error: "Bir işletme kendisine bağlanamaz." }, { status: 400 });
  if (message.includes("42P01") || message.includes("PGRST205")) return NextResponse.json({ error: "İşletme ilişkileri tablosu henüz oluşturulmadı (veritabanı migration'ı bekleniyor)." }, { status: 503 });
  return NextResponse.json({ error: "İşlem tamamlanamadı." }, { status: 500 });
}

export async function GET(request: Request) {
  const session = await requireBusinessAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  try {
    if (searchParams.has("search")) return NextResponse.json({ results: await searchBusinesses(searchParams.get("search") || "") });
    if (searchParams.get("independent") === "1") return NextResponse.json({ units: await listIndependentUnits() });
    const owner = parseEntityRef(searchParams.get("type"), searchParams.get("id"));
    return NextResponse.json({ businesses: await listLinkedBusinesses(owner) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await requireBusinessAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const createdBy = session.profileId || null;
  try {
    if (body.action === "create_independent") {
      const unit = await createIndependentUnit(body.unit || {}, createdBy);
      await recordActivity({ session, action: "Oluşturma", entity: "İşletme ve Şube Yönetimi", details: { message: `Bağımsız işletme eklendi: ${unit.name}`, result: "Başarılı" } }).catch(() => null);
      return NextResponse.json({ unit });
    }
    if (!isRelationshipType(body.relationshipType)) throw new BusinessRelationshipValidationError("Geçersiz ilişki türü.");
    const parent = parseEntityRef(body.parent?.type, body.parent?.id);
    if (body.action === "create_unit") {
      const result = await createUnitAndLink(parent, body.relationshipType, body.unit || {}, createdBy);
      await recordActivity({ session, action: "Oluşturma", entity: "İşletme ve Şube Yönetimi", details: { message: `${result.unit.name} eklendi (${body.relationshipType})`, result: "Başarılı", parent } }).catch(() => null);
      return NextResponse.json(result);
    }
    if (body.action === "link_existing") {
      const child = parseEntityRef(body.child?.type, body.child?.id);
      const relationship = await linkExisting(parent, child, body.relationshipType, createdBy);
      await recordActivity({ session, action: "Güncelleme", entity: "İşletme ve Şube Yönetimi", details: { message: "Mevcut işletme bağlandı", result: "Başarılı", parent, child } }).catch(() => null);
      return NextResponse.json({ relationship });
    }
    throw new BusinessRelationshipValidationError("Geçersiz işlem.");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const session = await requireBusinessAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  try {
    if (body.unitId !== undefined) {
      if (!isUuid(body.unitId)) throw new BusinessRelationshipValidationError("Geçersiz işletme kimliği.");
      return NextResponse.json({ unit: await updateBusinessUnit(body.unitId, body.unit || {}) });
    }
    if (!isUuid(body.relationshipId)) throw new BusinessRelationshipValidationError("Geçersiz ilişki kimliği.");
    if (!isRelationshipType(body.relationshipType)) throw new BusinessRelationshipValidationError("Geçersiz ilişki türü.");
    return NextResponse.json({ relationship: await updateRelationshipType(body.relationshipId, body.relationshipType) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const session = await requireBusinessAccess();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const relationshipId = new URL(request.url).searchParams.get("relationshipId");
  try {
    if (!isUuid(relationshipId)) throw new BusinessRelationshipValidationError("Geçersiz ilişki kimliği.");
    const removed = await unlinkRelationship(relationshipId);
    await recordActivity({ session, action: "Güncelleme", entity: "İşletme ve Şube Yönetimi", details: { message: "İşletme bağlantısı kaldırıldı (kayıtlar silinmedi)", result: "Başarılı", relationshipId: removed.id } }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

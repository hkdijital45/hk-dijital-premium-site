import { NextResponse } from "next/server";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { requireModuleAccess } from "@/lib/permissions";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "1";
    const filter = includeArchived ? "" : "&archived_at=is.null";
    const notes = await supabaseRest<any[]>(
      `customer_notes?company_id=eq.${id}${filter}&select=*&order=is_pinned.desc&order=created_at.desc`
    );
    return NextResponse.json({ notes });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Müşteri Notları", action: "Not listesini yükleme", error, companyId: id }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const content = String(body.content || "").trim();
  if (!content) return NextResponse.json({ error: "Not içeriği boş olamaz." }, { status: 400 });
  if (content.length > 8000) return NextResponse.json({ error: "Not içeriği 8000 karakteri aşamaz." }, { status: 400 });

  try {
    const now = new Date().toISOString();
    const rows = await supabaseRest<any[]>("customer_notes", {
      method: "POST",
      body: JSON.stringify({
        company_id: id,
        content,
        category: String(body.category || "Genel"),
        is_pinned: Boolean(body.is_pinned),
        created_by: session.profileId || null,
        created_by_name: session.fullName || session.email || "Admin",
        created_at: now,
        updated_at: now
      })
    });
    if (!rows[0]) return NextResponse.json({ error: "Not kaydedilemedi." }, { status: 500 });
    await recordActivity({ session, action: "Oluşturma", entity: "Müşteri Notu", entityId: rows[0].id, companyId: id, details: { message: "Yeni müşteri notu eklendi" } }).catch(() => null);
    return NextResponse.json({ ok: true, note: rows[0], message: "Not eklendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Müşteri Notu", action: "Not oluşturma", error, companyId: id }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const noteId = String(body.id || "");
  if (!uuidPattern.test(noteId)) return NextResponse.json({ error: "Geçerli bir not seçin." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.content === "string") {
    const trimmed = body.content.trim();
    if (!trimmed) return NextResponse.json({ error: "Not içeriği boş olamaz." }, { status: 400 });
    if (trimmed.length > 8000) return NextResponse.json({ error: "Not içeriği 8000 karakteri aşamaz." }, { status: 400 });
    patch.content = trimmed;
  }
  if (typeof body.category === "string") patch.category = body.category;
  if (typeof body.is_pinned === "boolean") patch.is_pinned = body.is_pinned;
  if (typeof body.archived === "boolean") patch.archived_at = body.archived ? new Date().toISOString() : null;

  try {
    const rows = await supabaseRest<any[]>(`customer_notes?id=eq.${noteId}&company_id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    if (!rows[0]) return NextResponse.json({ error: "Not bulunamadı." }, { status: 404 });
    await recordActivity({
      session,
      action: patch.archived_at ? "Arşivleme" : "Güncelleme",
      entity: "Müşteri Notu",
      entityId: noteId,
      companyId: id,
      details: { message: "Müşteri notu güncellendi" }
    }).catch(() => null);
    return NextResponse.json({ ok: true, note: rows[0], message: "Not güncellendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Müşteri Notu", action: "Not güncelleme", error, entityId: noteId, companyId: id }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const noteId = String(body.id || "");
  if (!uuidPattern.test(noteId)) return NextResponse.json({ error: "Geçerli bir not seçin." }, { status: 400 });

  try {
    const rows = await supabaseRest<any[]>(`customer_notes?id=eq.${noteId}&company_id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    });
    if (!rows[0]) return NextResponse.json({ error: "Not bulunamadı." }, { status: 404 });
    await recordActivity({ session, action: "Arşivleme", entity: "Müşteri Notu", entityId: noteId, companyId: id, details: { message: "Müşteri notu arşivlendi", result: "Başarılı" } }).catch(() => null);
    return NextResponse.json({ ok: true, note: rows[0], message: "Not arşivlendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Müşteri Notu", action: "Not arşivleme", error, entityId: noteId, companyId: id }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

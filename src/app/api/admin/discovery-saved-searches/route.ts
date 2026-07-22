import { NextResponse } from "next/server";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { requireModuleAccess } from "@/lib/permissions";

export async function GET() {
  const session = await requireModuleAccess("musteri-bulucu");
  if (!session || !session.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  try {
    const searches = await supabaseRest<any[]>(
      `customer_discovery_saved_searches?owner_user_id=eq.${session.profileId}&archived_at=is.null&select=*&order=updated_at.desc`
    );
    return NextResponse.json({ searches });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Kayıtlı Arama", action: "Liste yükleme", error }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("musteri-bulucu");
  if (!session || !session.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Arama adı zorunludur." }, { status: 400 });
  if (name.length > 120) return NextResponse.json({ error: "Arama adı 120 karakteri aşamaz." }, { status: 400 });
  if (typeof body.filters !== "object" || body.filters === null) return NextResponse.json({ error: "Geçersiz filtre verisi." }, { status: 400 });

  try {
    const existing = await supabaseRest<any[]>(
      `customer_discovery_saved_searches?owner_user_id=eq.${session.profileId}&archived_at=is.null&name=ilike.${encodeURIComponent(name)}&select=id`
    );
    if (existing.length) return NextResponse.json({ error: "Bu isimde kayıtlı bir arama zaten var. Farklı bir ad seçin." }, { status: 409 });

    const now = new Date().toISOString();
    const rows = await supabaseRest<any[]>("customer_discovery_saved_searches", {
      method: "POST",
      body: JSON.stringify({
        owner_user_id: session.profileId,
        name,
        description: body.description ? String(body.description).slice(0, 500) : null,
        filters_json: body.filters,
        result_count: Number(body.result_count || 0),
        last_run_at: body.result_count ? now : null,
        created_at: now,
        updated_at: now
      })
    });
    if (!rows[0]) return NextResponse.json({ error: "Arama kaydedilemedi." }, { status: 500 });
    await recordActivity({ session, action: "Oluşturma", entity: "Kayıtlı Arama", entityId: rows[0].id, details: { message: `"${name}" araması kaydedildi` } }).catch(() => null);
    return NextResponse.json({ ok: true, search: rows[0], message: "Arama kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Kayıtlı Arama", action: "Arama kaydetme", error }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await requireModuleAccess("musteri-bulucu");
  if (!session || !session.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir kayıt seçin." }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: "Arama adı boş olamaz." }, { status: 400 });
    patch.name = trimmed;
  }
  if (typeof body.description === "string") patch.description = body.description.slice(0, 500);
  if (typeof body.result_count === "number") {
    patch.result_count = body.result_count;
    patch.last_run_at = new Date().toISOString();
  }
  if (typeof body.archived === "boolean") patch.archived_at = body.archived ? new Date().toISOString() : null;

  try {
    const rows = await supabaseRest<any[]>(`customer_discovery_saved_searches?id=eq.${id}&owner_user_id=eq.${session.profileId}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    if (!rows[0]) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    await recordActivity({ session, action: patch.archived_at ? "Arşivleme" : "Güncelleme", entity: "Kayıtlı Arama", entityId: id, details: { message: "Kayıtlı arama güncellendi" } }).catch(() => null);
    return NextResponse.json({ ok: true, search: rows[0], message: "Kayıtlı arama güncellendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Kayıtlı Arama", action: "Güncelleme", error, entityId: id }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireModuleAccess("musteri-bulucu");
  if (!session || !session.profileId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir kayıt seçin." }, { status: 400 });

  try {
    const rows = await supabaseRest<any[]>(`customer_discovery_saved_searches?id=eq.${id}&owner_user_id=eq.${session.profileId}`, {
      method: "PATCH",
      body: JSON.stringify({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    });
    if (!rows[0]) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    await recordActivity({ session, action: "Arşivleme", entity: "Kayıtlı Arama", entityId: id, details: { message: "Kayıtlı arama silindi", result: "Başarılı" } }).catch(() => null);
    return NextResponse.json({ ok: true, message: "Kayıtlı arama silindi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Kayıtlı Arama", action: "Silme", error, entityId: id }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

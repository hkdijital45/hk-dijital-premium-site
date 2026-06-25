/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";

const actionMessages: Record<string, string> = {
  activate: "Müşteri aktifleştirildi.",
  deactivate: "Müşteri pasifleştirildi.",
  archive: "Müşteri arşivlendi. Arşivlenenler sekmesinden bulabilirsiniz.",
  unarchive: "Müşteri arşivden çıkarıldı.",
  delete: "Müşteri silinenlere taşındı.",
  restore: "Müşteri geri yüklendi."
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });

  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  if (!actionMessages[action]) return NextResponse.json({ error: "Geçerli bir işlem seçin." }, { status: 400 });

  const now = new Date().toISOString();
  const actorId = session.profileId || null;
  const patchByAction: Record<string, Record<string, unknown>> = {
    activate: { status: "Aktif", is_active: true, archived_at: null, deleted_at: null, updated_at: now },
    deactivate: { status: "Pasif", is_active: false, updated_at: now },
    archive: { status: "Arşivli", is_active: false, archived_at: now, archived_by: actorId, deleted_at: null, updated_at: now },
    unarchive: { status: "Aktif", is_active: true, archived_at: null, archived_by: null, updated_at: now },
    delete: { status: "Silindi", is_active: false, deleted_at: now, deleted_by: actorId, updated_at: now },
    restore: { status: "Aktif", is_active: true, archived_at: null, archived_by: null, deleted_at: null, deleted_by: null, updated_at: now }
  };

  try {
    const rows = await supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patchByAction[action])
    });
    const company = rows[0];
    if (!company) return NextResponse.json({ error: "Müşteri kaydı bulunamadı." }, { status: 404 });
    await recordActivity({
      session,
      action: "Güncelleme",
      entity: "Firma",
      entityId: id,
      companyId: id,
      details: { message: actionMessages[action], lifecycle_action: action, result: "Başarılı" }
    }).catch(() => null);
    return NextResponse.json({ ok: true, company, message: actionMessages[action] });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

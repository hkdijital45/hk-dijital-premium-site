import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { recordActivity } from "@/lib/activity-log";
import { uuidPattern } from "@/lib/meta-pixel-admin";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("kullanicilar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir anahtar seçin." }, { status: 400 });

  try {
    const rows = await supabaseRest<any[]>(
      `hidden_access_sessions?key_id=eq.${id}&revoked_at=is.null`,
      { method: "PATCH", body: JSON.stringify({ revoked_at: new Date().toISOString() }) }
    );
    await recordActivity({ session, action: "Arşivleme", entity: "Gizli Erişim Anahtarı", entityId: id, details: { message: `Bu anahtara ait ${rows.length} aktif oturum kapatıldı`, result: "Başarılı" } });
    return NextResponse.json({ ok: true, revokedCount: rows.length });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

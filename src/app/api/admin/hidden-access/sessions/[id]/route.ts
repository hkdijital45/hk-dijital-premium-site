import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { recordActivity } from "@/lib/activity-log";
import { uuidPattern } from "@/lib/meta-pixel-admin";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("kullanicilar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçerli bir oturum seçin." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const patch: Record<string, unknown> = {};
  let message = "Oturum güncellendi";

  if (action === "revoke") {
    patch.revoked_at = new Date().toISOString();
    message = "Gizli erişim oturumu kapatıldı";
  } else if (action === "rename_device") {
    const deviceName = String(body.deviceName || "").trim().slice(0, 120);
    patch.device_name = deviceName || null;
    message = "Cihaz adı güncellendi";
  } else {
    return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  }

  try {
    const rows = await supabaseRest<any[]>(`hidden_access_sessions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (!rows[0]) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 404 });
    await recordActivity({ session, action: "Güncelleme", entity: "Gizli Erişim Oturumu", entityId: id, details: { message } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

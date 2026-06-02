import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await requireModuleAccess("tema-ayarlari");
  if (!session) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  const theme = await request.json();
  try {
    const rows = await supabaseRest<any[]>("site_settings?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ key: "admin_theme", value: theme, updated_at: new Date().toISOString() })
    });
    await recordActivity({ session, action: "Güncelleme", entity: "Tema Ayarları", details: { message: "Admin teması güncellendi" } });
    return NextResponse.json({ ok: true, theme: rows[0]?.value || theme, message: "Tema ayarları kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

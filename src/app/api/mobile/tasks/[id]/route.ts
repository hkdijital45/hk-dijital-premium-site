import { NextResponse } from "next/server";
import { requireMobileModuleAccess } from "@/lib/mobile-auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const TASK_STATUSES = ["Yapılacak", "Devam Ediyor", "Beklemede", "Tamamlandı", "İptal"];

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = requireMobileModuleAccess(request, "gorevler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status || "");
  if (!TASK_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Geçersiz görev durumu." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status, updated_at: now };
  update.completed_at = status === "Tamamlandı" ? now : null;

  try {
    const rows = await supabaseRest<Array<Record<string, unknown>>>(`agency_tasks?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(update)
    });
    if (!rows.length) return NextResponse.json({ error: "Görev bulunamadı." }, { status: 404 });
    return NextResponse.json({ task: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

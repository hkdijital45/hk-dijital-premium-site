import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const rows = await supabaseRest(`agent_runs?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      saved_at: new Date().toISOString(),
      saved_by: session.profileId || session.authUserId || null,
      saved_title: String(body.title || "Kaydedilen Agent Analizi").slice(0, 180),
      updated_at: new Date().toISOString()
    })
  });
  return NextResponse.json({ ok: true, message: "Bu analiz Agent Kayıtları’nda saklandı.", run: Array.isArray(rows) ? rows[0] : rows });
}

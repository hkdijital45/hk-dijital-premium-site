import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const cancelReason = String(body.reason || "Kullanıcı tarafından iptal edildi.").slice(0, 500);

  const rows = await supabaseRest<unknown[]>(`agent_runs?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_reason: cancelReason,
      updated_at: new Date().toISOString()
    })
  });

  return NextResponse.json({ ok: true, run: rows?.[0] || null });
}

import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-optimization");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = String(body.status || "");
  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Durum yalnızca 'approved' veya 'rejected' olabilir." }, { status: 400 });
  }

  try {
    const updated = await supabaseRest<Array<Record<string, unknown>>>(
      `ad_optimization_suggestions?id=eq.${encodeURIComponent(id)}&status=eq.pending`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
          approved_at: new Date().toISOString(),
          approved_by: session.profileId || null
        })
      }
    );
    if (!updated.length) return NextResponse.json({ error: "Öneri bulunamadı veya zaten karar verilmiş." }, { status: 409 });
    return NextResponse.json({ suggestion: updated[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

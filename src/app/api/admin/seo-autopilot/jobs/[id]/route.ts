import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("seo-autopilot");
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
      `seo_autopilot_jobs?id=eq.${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ status, approved_at: new Date().toISOString(), approved_by: session.profileId || null }) }
    );
    return NextResponse.json({ job: updated[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

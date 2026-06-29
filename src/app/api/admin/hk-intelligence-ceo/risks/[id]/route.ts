/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const patch = {
    status: body.status || "resolved",
    resolved_at: body.status === "open" ? null : new Date().toISOString(),
    recommendation: body.recommendation,
    metadata: body.metadata,
    updated_at: new Date().toISOString()
  };
  try {
    const rows = await supabaseRest<any[]>(`hk_risk_events?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    return NextResponse.json({ ok: true, risk: rows[0] || null });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

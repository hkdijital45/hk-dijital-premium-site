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
  const allowed = ["agent_name", "role_label", "status", "current_task", "success_rate", "estimated_monthly_cost", "preferred_provider", "capabilities", "notes"];
  const patch = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
  try {
    const rows = await supabaseRest<any[]>(`hk_virtual_agents?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
    });
    return NextResponse.json({ ok: true, agent: rows[0] || null });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

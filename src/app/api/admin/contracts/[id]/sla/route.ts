import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const slaTypes = ["report_delivery", "response_time", "optimization_frequency", "content_delivery", "custom"];

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const slaType = slaTypes.includes(String(body.slaType)) ? String(body.slaType) : "custom";
  const description = String(body.description || "").trim();
  const targetValue = String(body.targetValue || "").trim();
  if (!description || !targetValue) return NextResponse.json({ error: "description ve targetValue zorunludur." }, { status: 400 });

  try {
    const inserted = await supabaseRest<Array<Record<string, unknown>>>("sla_definitions", {
      method: "POST",
      body: JSON.stringify({ contract_id: id, sla_type: slaType, description, target_value: targetValue })
    });
    return NextResponse.json({ sla: inserted[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ operations: [], warning: "Supabase bağlantısı yok." });
  const rows = await supabaseRest<any[]>("hk_ai_operations_calendar?select=*&order=weekday.asc,scheduled_time.asc").catch(() => []);
  return NextResponse.json({ operations: rows });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  try {
    const rows = await supabaseRest<any[]>("hk_ai_operations_calendar", {
      method: "POST",
      body: JSON.stringify({
        title: body.title || "Yeni operasyon",
        operation_type: body.operation_type || body.operationType || "workflow_task",
        frequency: body.frequency || "weekly",
        weekday: body.weekday ?? null,
        scheduled_time: body.scheduled_time || body.scheduledTime || null,
        target_company_id: body.target_company_id || body.targetCompanyId || null,
        assigned_agent_key: body.assigned_agent_key || body.assignedAgentKey || null,
        is_active: body.is_active ?? true,
        metadata: body.metadata || {}
      })
    });
    return NextResponse.json({ ok: true, operation: rows[0] || null });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

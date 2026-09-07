import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";

// Automations reuses the existing agent_scheduled_tasks table (full CRUD
// here) plus a read-only view of hk_ai_operations_calendar for context —
// no new automations table.
export async function GET() {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ scheduledTasks: [], calendar: [] });

  const [scheduledTasks, calendar] = await Promise.all([
    supabaseRest<unknown[]>("agent_scheduled_tasks?select=*&order=created_at.desc&limit=100").catch(() => []),
    supabaseRest<unknown[]>("hk_ai_operations_calendar?select=*&order=next_run_at.asc.nullslast&limit=50").catch(() => [])
  ]);
  return NextResponse.json({ scheduledTasks, calendar });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!name || !prompt) return NextResponse.json({ error: "Otomasyon adı ve görev açıklaması zorunludur." }, { status: 400 });

  try {
    const rows = await supabaseRest<unknown[]>("agent_scheduled_tasks", {
      method: "POST",
      body: JSON.stringify({
        name,
        prompt,
        customer_id: body.customerId || null,
        task_type: body.taskType || "workflow_task",
        schedule_frequency: body.frequency || "weekly",
        schedule_day: body.day || "Pazartesi",
        schedule_time: body.time || "09:00",
        provider_mode: body.providerMode || "auto",
        multi_agent: Boolean(body.multiAgent),
        output_format: body.outputFormat || "aksiyon planı",
        is_active: true,
        created_by: session.profileId || session.authUserId || null
      })
    });
    return NextResponse.json({ ok: true, scheduledTask: rows[0] });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

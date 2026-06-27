import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const tasks = hasSupabaseConfig()
    ? await supabaseRest<unknown[]>("agent_scheduled_tasks?select=*&order=next_run_at.asc").catch(() => [])
    : [];
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const taskType = String(body.taskType || "ad_analysis").trim();
  if (!name) return NextResponse.json({ error: "Görev adı boş olamaz." }, { status: 400 });
  const rows = await supabaseRest<unknown[]>("agent_scheduled_tasks", {
    method: "POST",
    body: JSON.stringify({
      customer_id: body.customerId || null,
      name,
      task_type: taskType,
      schedule_frequency: body.scheduleFrequency || "weekly",
      schedule_day: body.scheduleDay || "Pazartesi",
      schedule_time: body.scheduleTime || "09:00",
      provider_mode: body.providerMode || "auto",
      multi_agent: Boolean(body.multiAgent),
      output_format: body.outputFormat || "detailed_report",
      prompt: body.prompt || "",
      is_active: body.isActive !== false,
      next_run_at: body.nextRunAt || null,
      created_by: session.profileId || session.authUserId || null
    })
  });
  return NextResponse.json({ ok: true, task: rows[0] || null });
}

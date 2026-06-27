import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch = {
    name: body.name,
    task_type: body.taskType,
    schedule_frequency: body.scheduleFrequency,
    schedule_day: body.scheduleDay,
    schedule_time: body.scheduleTime,
    provider_mode: body.providerMode,
    multi_agent: typeof body.multiAgent === "boolean" ? body.multiAgent : undefined,
    output_format: body.outputFormat,
    prompt: body.prompt,
    is_active: typeof body.isActive === "boolean" ? body.isActive : undefined,
    next_run_at: body.nextRunAt,
    updated_at: new Date().toISOString()
  };
  const clean = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
  const rows = await supabaseRest<unknown[]>(`agent_scheduled_tasks?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(clean)
  });
  return NextResponse.json({ ok: true, task: rows[0] || null });
}

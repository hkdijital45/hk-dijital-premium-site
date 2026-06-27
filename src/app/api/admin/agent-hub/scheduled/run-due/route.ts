import { NextResponse } from "next/server";
import { runAgentTask, type AgentProviderKey, type AgentTaskType } from "@/lib/agent-hub";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type ScheduledTaskRow = {
  id: string;
  customer_id?: string | null;
  task_type?: string | null;
  provider_mode?: string | null;
  output_format?: string | null;
  prompt?: string | null;
  name?: string | null;
  multi_agent?: boolean | null;
  created_by?: string | null;
};

const providerModes = new Set(["auto", "openai", "anthropic", "gemini", "groq", "manus", "openrouter", "ollama", "demo"]);

export async function POST(request: Request) {
  const session = await requireModuleAccess("agent-hub");
  const secret = request.headers.get("x-agent-hub-secret") || new URL(request.url).searchParams.get("secret");
  const isProduction = process.env.NODE_ENV === "production";
  if (!session && (!process.env.AGENT_HUB_CRON_SECRET || secret !== process.env.AGENT_HUB_CRON_SECRET)) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  }
  if (isProduction && !process.env.AGENT_HUB_CRON_SECRET) {
    return NextResponse.json({ error: "Production ortamında AGENT_HUB_CRON_SECRET zorunludur." }, { status: 403 });
  }
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const now = new Date().toISOString();
  const tasks = await supabaseRest<ScheduledTaskRow[]>(`agent_scheduled_tasks?is_active=eq.true&or=(next_run_at.is.null,next_run_at.lte.${encodeURIComponent(now)})&select=*`).catch(() => []);
  const results = [];
  for (const task of tasks.slice(0, 5)) {
    const providerMode = providerModes.has(String(task.provider_mode || "auto"))
      ? String(task.provider_mode || "auto") as AgentProviderKey | "auto"
      : "auto";
    const result = await runAgentTask({
      customerId: task.customer_id || null,
      taskType: (task.task_type || "ad_analysis") as AgentTaskType,
      requestedProvider: providerMode,
      outputFormat: task.output_format || "detaylı rapor",
      prompt: task.prompt || task.name || "Planlanmış agent görevi",
      multiAgent: Boolean(task.multi_agent),
      createdBy: task.created_by || null
    });
    await supabaseRest(`agent_scheduled_tasks?id=eq.${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ last_run_at: now, updated_at: now })
    }).catch(() => null);
    results.push({ taskId: task.id, status: result.status });
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}

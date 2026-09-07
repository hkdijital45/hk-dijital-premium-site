import { NextResponse } from "next/server";
import { runAgentTask, type AgentProviderKey, type AgentTaskType } from "@/lib/agent-hub";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { safeCompare } from "@/lib/secure-compare";
import { computeNextRunAt } from "@/lib/ai-workforce-schema";

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
  schedule_frequency?: string | null;
  schedule_day?: string | null;
  schedule_time?: string | null;
};

const providerModes = new Set(["auto", "openai", "anthropic", "gemini", "groq", "manus", "openrouter", "ollama", "demo"]);

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

// Accepts three auth paths: (1) an authenticated agent-hub session for manual
// testing, (2) the legacy x-agent-hub-secret / ?secret param, or (3) the
// standard Vercel Cron "Authorization: Bearer $CRON_SECRET" header — the
// exact mechanism vercel.json's own crons array uses (see cronAuthorized() in
// growth-intelligence/run-daily). Adding (3) is what makes it possible to
// wire this endpoint into vercel.json without inventing or hardcoding a new
// secret: CRON_SECRET is already configured in Vercel Production.
async function isAuthorized(request: Request) {
  if (safeCompare(bearerToken(request), process.env.CRON_SECRET)) return true;
  const legacySecret = request.headers.get("x-agent-hub-secret") || new URL(request.url).searchParams.get("secret");
  if (process.env.AGENT_HUB_CRON_SECRET && legacySecret === process.env.AGENT_HUB_CRON_SECRET) return true;
  const session = await requireModuleAccess("agent-hub");
  return Boolean(session);
}

export async function POST(request: Request) {
  if (!(await isAuthorized(request))) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (process.env.NODE_ENV === "production" && !process.env.AGENT_HUB_CRON_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Production ortamında CRON_SECRET veya AGENT_HUB_CRON_SECRET zorunludur." }, { status: 403 });
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
    const nextRunAt = computeNextRunAt({ frequency: task.schedule_frequency, day: task.schedule_day, time: task.schedule_time });
    await supabaseRest(`agent_scheduled_tasks?id=eq.${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ last_run_at: now, next_run_at: nextRunAt, updated_at: now })
    }).catch(() => null);
    results.push({ taskId: task.id, status: result.status, nextRunAt });
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}

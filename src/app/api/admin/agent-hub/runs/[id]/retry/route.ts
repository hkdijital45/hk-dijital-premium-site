import { NextResponse } from "next/server";
import { runAgentTask, type AgentProviderKey, type AgentTaskType } from "@/lib/agent-hub";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type RunRow = {
  customer_id?: string | null;
  task_type?: AgentTaskType | null;
  priority?: string | null;
  requested_provider?: AgentProviderKey | null;
  input_summary?: string | null;
  run_mode?: string | null;
  retry_count?: number | null;
};

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const { id } = await params;
  const rows = await supabaseRest<RunRow[]>(`agent_runs?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => []);
  const oldRun = rows[0];
  if (!oldRun?.task_type) return NextResponse.json({ error: "Tekrar çalıştırılacak agent görevi bulunamadı." }, { status: 404 });

  const result = await runAgentTask({
    customerId: oldRun.customer_id || null,
    taskType: oldRun.task_type,
    priority: oldRun.priority || "normal",
    requestedProvider: oldRun.requested_provider || "auto",
    outputFormat: "detaylı rapor",
    prompt: oldRun.input_summary || "Önceki agent görevini aynı bağlamla yeniden çalıştır.",
    multiAgent: oldRun.run_mode === "multi_agent",
    parentRunId: id,
    retryCount: Number(oldRun.retry_count || 0) + 1,
    createdBy: session.profileId || session.authUserId || null
  });

  return NextResponse.json(result);
}

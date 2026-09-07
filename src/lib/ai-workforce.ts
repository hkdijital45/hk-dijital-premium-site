import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { runAgentTask, type AgentProviderKey, type AgentTaskType } from "@/lib/agent-hub";
import { aggregateCostByKey, buildDirectorPrompt, mapAgentKeyToTaskType, normalizePreferredProvider, sumEstimatedCost, type CostRow } from "@/lib/ai-workforce-schema";

export async function logAiWorkforceActivity(entry: {
  eventType: string;
  summary: string;
  agentKey?: string | null;
  companyId?: string | null;
  runId?: string | null;
  approvalId?: string | null;
  taskId?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!hasSupabaseConfig()) return null;
  return supabaseRest("ai_activity_log", {
    method: "POST",
    body: JSON.stringify({
      event_type: entry.eventType,
      summary: entry.summary.slice(0, 500),
      agent_key: entry.agentKey || null,
      company_id: entry.companyId || null,
      run_id: entry.runId || null,
      approval_id: entry.approvalId || null,
      task_id: entry.taskId || null,
      created_by: entry.createdBy || null,
      metadata: entry.metadata || {}
    })
  }).catch(() => null);
}

type VirtualAgentRow = {
  id: string;
  agent_key: string;
  agent_name: string;
  role_label: string;
  status?: string | null;
  current_task?: string | null;
  success_rate?: number | null;
  last_run_at?: string | null;
  preferred_provider?: string | null;
  capabilities?: unknown;
};

type AgentRunSummaryRow = {
  id: string;
  agent_key?: string | null;
  status?: string | null;
  estimated_cost?: number | null;
  tokens_used?: number | null;
  actual_provider?: string | null;
  task_type?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
};

const startOfTodayIso = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
};

const startOfMonthIso = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
};

export async function getVirtualAgentsWithRuns() {
  if (!hasSupabaseConfig()) return [] as Array<VirtualAgentRow & { lastRun: AgentRunSummaryRow | null }>;
  const agents = await supabaseRest<VirtualAgentRow[]>("hk_virtual_agents?select=*&order=agent_name.asc").catch(() => []);
  const runs = await supabaseRest<AgentRunSummaryRow[]>(
    "agent_runs?agent_key=not.is.null&select=id,agent_key,status,estimated_cost,tokens_used,actual_provider,task_type,completed_at,created_at&order=created_at.desc&limit=200"
  ).catch(() => []);
  return agents.map((agent) => ({
    ...agent,
    lastRun: runs.find((run) => run.agent_key === agent.agent_key) || null
  }));
}

export async function getOverviewSnapshot() {
  if (!hasSupabaseConfig()) {
    return {
      configured: false,
      activeAgents: 0,
      activeAutomations: 0,
      pendingApprovals: 0,
      openRecommendations: 0,
      criticalRisks: 0,
      completedToday: 0,
      failedRecent: 0,
      costToday: 0,
      costMonth: 0,
      accountsNeedingAttention: 0,
      recentActivity: [] as unknown[]
    };
  }
  const todayIso = startOfTodayIso();
  const monthIso = startOfMonthIso();

  const [agents, scheduled, calendar, approvals, recommendations, risks, runsToday, runsMonth, recentFailed, recentActivity] = await Promise.all([
    supabaseRest<{ status?: string }[]>("hk_virtual_agents?select=status").catch(() => []),
    supabaseRest<{ id: string }[]>("agent_scheduled_tasks?is_active=eq.true&select=id").catch(() => []),
    supabaseRest<{ id: string }[]>("hk_ai_operations_calendar?is_active=eq.true&select=id").catch(() => []),
    supabaseRest<{ id: string }[]>("ai_approval_requests?status=eq.pending&select=id").catch(() => []),
    supabaseRest<{ id: string }[]>("hk_recommendations?status=eq.open&select=id").catch(() => []),
    supabaseRest<{ id: string; company_id?: string | null }[]>("hk_risk_events?status=eq.open&severity=in.(high,critical)&select=id,company_id").catch(() => []),
    supabaseRest<AgentRunSummaryRow[]>(`agent_runs?created_at=gte.${encodeURIComponent(todayIso)}&select=id,status,estimated_cost&limit=500`).catch(() => []),
    supabaseRest<AgentRunSummaryRow[]>(`agent_runs?created_at=gte.${encodeURIComponent(monthIso)}&select=id,estimated_cost&limit=2000`).catch(() => []),
    supabaseRest<AgentRunSummaryRow[]>("agent_runs?status=eq.failed&order=created_at.desc&limit=20&select=id,created_at").catch(() => []),
    supabaseRest<unknown[]>("ai_activity_log?select=*&order=created_at.desc&limit=15").catch(() => [])
  ]);

  return {
    configured: true,
    activeAgents: agents.filter((agent) => agent.status === "ready" || agent.status === "active").length,
    activeAutomations: scheduled.length + calendar.length,
    pendingApprovals: approvals.length,
    openRecommendations: recommendations.length,
    criticalRisks: risks.length,
    completedToday: runsToday.filter((run) => (run.status || "").startsWith("completed")).length,
    failedRecent: recentFailed.length,
    costToday: sumEstimatedCost(runsToday),
    costMonth: sumEstimatedCost(runsMonth),
    accountsNeedingAttention: new Set(risks.map((risk) => risk.company_id).filter(Boolean)).size,
    recentActivity
  };
}

// Shared by both the HK Intelligence CEO roster's "Run" button
// (src/app/api/admin/hk-intelligence-ceo/agents/[id]/run) and the AI
// Workforce Agents screen — one real execution path, not two.
export async function runVirtualAgentById(agentId: string, options: { companyId?: string | null; prompt?: string | null; priority?: "düşük" | "normal" | "yüksek" | "kritik"; createdBy?: string | null }) {
  if (!hasSupabaseConfig()) return { error: "Supabase bağlantısı yapılandırılmadı." as const };
  const agents = await supabaseRest<VirtualAgentRow[]>(`hk_virtual_agents?id=eq.${encodeURIComponent(agentId)}&select=*&limit=1`).catch(() => []);
  const agent = agents[0];
  if (!agent) return { error: "Ajan bulunamadı." as const };

  const taskType = mapAgentKeyToTaskType(agent.agent_key);
  const requestedProvider = normalizePreferredProvider(agent.preferred_provider);
  const prompt = buildDirectorPrompt({
    agentName: agent.agent_name,
    roleLabel: agent.role_label,
    companyId: options.companyId,
    customPrompt: options.prompt
  });

  const result = await runAgentTask({
    customerId: options.companyId || null,
    taskType,
    priority: options.priority || "normal",
    requestedProvider,
    prompt,
    createdBy: options.createdBy || null
  });

  const succeeded = result.status === "completed" || result.status === "completed_with_fallback";
  const nextSuccessRate = Math.round(((agent.success_rate ?? 80) * 0.8) + ((succeeded ? 100 : 40) * 0.2));

  await supabaseRest(`hk_virtual_agents?id=eq.${encodeURIComponent(agentId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "ready",
      current_task: result.finalReport?.executiveSummary?.slice(0, 220) || agent.role_label,
      last_run_at: new Date().toISOString(),
      success_rate: nextSuccessRate,
      updated_at: new Date().toISOString()
    })
  }).catch(() => null);

  if (result.runId) {
    await supabaseRest(`agent_runs?id=eq.${encodeURIComponent(result.runId)}`, {
      method: "PATCH",
      body: JSON.stringify({ agent_key: agent.agent_key })
    }).catch(() => null);
  }

  await logAiWorkforceActivity({
    eventType: "agent_run",
    summary: `${agent.agent_name} çalıştırıldı: ${result.status}`,
    agentKey: agent.agent_key,
    companyId: options.companyId,
    runId: result.runId || null,
    createdBy: options.createdBy || null
  });

  return { agent, result };
}

// Shared by the AI Workforce Director command box and HK Admin's
// "Send to AI Team" customer-context action — same persisted execution path.
export async function runDirectorCommand(options: {
  prompt: string;
  companyId?: string | null;
  taskType?: AgentTaskType;
  requestedProvider?: AgentProviderKey | "auto";
  multiAgent?: boolean;
  createdBy?: string | null;
  eventType?: string;
}) {
  // AI_WORKFORCE_DIRECTOR_PROVIDER is an optional override (unset by default,
  // in which case the existing auto-routing priority list decides) — never a
  // required secret, and reuses the same AgentProviderKey values as every
  // other provider selection in the codebase.
  const directorDefault = normalizePreferredProvider(process.env.AI_WORKFORCE_DIRECTOR_PROVIDER);
  const result = await runAgentTask({
    customerId: options.companyId || null,
    taskType: options.taskType || "workflow_task",
    requestedProvider: options.requestedProvider || directorDefault,
    prompt: options.prompt,
    multiAgent: options.multiAgent,
    createdBy: options.createdBy || null
  });

  await logAiWorkforceActivity({
    eventType: options.eventType || "director_command",
    summary: result.finalReport?.executiveSummary?.slice(0, 300) || `Director görevi tamamlandı: ${result.status}`,
    companyId: options.companyId,
    runId: result.runId || null,
    createdBy: options.createdBy || null
  });

  return result;
}

export async function getCostBreakdown() {
  if (!hasSupabaseConfig()) return { today: 0, month: 0, byProvider: [], byAgent: [], note: "Supabase yapılandırılmadı." };
  const monthIso = startOfMonthIso();
  const todayIso = startOfTodayIso();
  const rows = await supabaseRest<AgentRunSummaryRow[]>(
    `agent_runs?created_at=gte.${encodeURIComponent(monthIso)}&select=id,agent_key,actual_provider,estimated_cost,tokens_used,created_at&limit=3000`
  ).catch(() => []);
  const todayRows = rows.filter((row) => (row.created_at || "") >= todayIso);
  const byProvider = aggregateCostByKey(rows.map((row): CostRow => ({ key: row.actual_provider || "bilinmiyor", estimated_cost: row.estimated_cost, tokens_used: row.tokens_used })));
  const byAgent = aggregateCostByKey(
    rows.filter((row) => row.agent_key).map((row): CostRow => ({ key: row.agent_key || "diğer", estimated_cost: row.estimated_cost, tokens_used: row.tokens_used }))
  );
  return {
    today: sumEstimatedCost(todayRows),
    month: sumEstimatedCost(rows),
    byProvider,
    byAgent,
    note: "Bu değerler sağlayıcı çıktı boyutuna göre hesaplanan tahmini maliyettir (Estimated Cost); gerçek faturalama verisi (Actual Cost) için sağlayıcı hesabı fatura panelleri kontrol edilmelidir."
  };
}

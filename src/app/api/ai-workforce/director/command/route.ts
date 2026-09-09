import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig } from "@/lib/supabase";
import { AI_WORKFORCE_MODULE, aiWorkforcePlaybooks, type AiWorkforcePlaybookKey } from "@/lib/ai-workforce-schema";
import { runDirectorCommand } from "@/lib/ai-workforce";
import type { AgentTaskType } from "@/lib/agent-hub";

const allowedTaskTypes = new Set<AgentTaskType>([
  "ad_analysis", "crm_summary", "content_generation", "seo_analysis", "competitor_research",
  "market_research", "pricing_research", "sector_discovery", "deep_report", "proposal_generation",
  "customer_report", "code_review", "fast_answer", "workflow_task", "long_web_research"
]);

export async function POST(request: Request) {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const companyId = typeof body.companyId === "string" && body.companyId ? body.companyId : null;
  const periodDays = Number.isFinite(Number(body.periodDays)) && Number(body.periodDays) > 0 ? Math.min(Number(body.periodDays), 365) : undefined;

  // Hazır iş akışı seçildiyse (Control Center'daki playbook kartları) prompt
  // istemciden değil, sunucu tarafında sabit tanımlanmış preset'ten
  // üretilir — serbest metin isteğiyle aynı davranışta ama içeriği güvenilir
  // ve tutarlıdır (bkz. send-to-ai-team route'undaki aynı desen).
  const playbookKey = typeof body.playbookKey === "string" ? (body.playbookKey as AiWorkforcePlaybookKey) : null;
  if (playbookKey) {
    const playbook = aiWorkforcePlaybooks[playbookKey];
    if (!playbook) return NextResponse.json({ error: "Geçersiz iş akışı.", availablePlaybooks: Object.keys(aiWorkforcePlaybooks) }, { status: 400 });
    if (playbook.requiresCustomer && !companyId) return NextResponse.json({ error: "Bu iş akışı için müşteri seçimi zorunludur." }, { status: 400 });

    const periodLabel = typeof body.periodLabel === "string" && body.periodLabel ? body.periodLabel : (periodDays ? `son ${periodDays} gün` : undefined);
    const result = await runDirectorCommand({
      prompt: playbook.buildPrompt({ customerName: typeof body.customerName === "string" ? body.customerName : null, periodLabel }),
      companyId,
      taskType: playbook.taskType,
      multiAgent: playbook.multiAgent,
      periodDays,
      createdBy: session.profileId || session.authUserId || null,
      eventType: "playbook_run"
    });

    return NextResponse.json({
      ok: true,
      runId: result.runId,
      status: result.status,
      selectedProvider: result.selectedProviderLabel,
      finalReport: result.finalReport,
      errorMessage: result.errorMessage,
      customerContextSummary: result.customerContextSummary
    });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "Komut boş olamaz." }, { status: 400 });

  const taskType = typeof body.taskType === "string" && allowedTaskTypes.has(body.taskType as AgentTaskType) ? (body.taskType as AgentTaskType) : "workflow_task";

  const result = await runDirectorCommand({
    prompt,
    companyId,
    taskType,
    multiAgent: Boolean(body.multiAgent),
    periodDays,
    createdBy: session.profileId || session.authUserId || null,
    eventType: "director_command"
  });

  return NextResponse.json({
    ok: true,
    runId: result.runId,
    status: result.status,
    selectedProvider: result.selectedProviderLabel,
    finalReport: result.finalReport,
    errorMessage: result.errorMessage,
    customerContextSummary: result.customerContextSummary
  });
}

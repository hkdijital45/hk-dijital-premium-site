import { NextResponse } from "next/server";
import { runAgentTask, type AgentTaskType } from "@/lib/agent-hub";
import { requireModuleAccess } from "@/lib/permissions";

const allowedTaskTypes = new Set([
  "ad_analysis",
  "crm_summary",
  "content_generation",
  "seo_analysis",
  "competitor_research",
  "market_research",
  "pricing_research",
  "sector_discovery",
  "deep_report",
  "proposal_generation",
  "customer_report",
  "code_review",
  "fast_answer",
  "workflow_task"
]);

export async function POST(request: Request) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const taskType = String(body.taskType || "fast_answer") as AgentTaskType;
  if (!allowedTaskTypes.has(taskType)) return NextResponse.json({ error: "Geçersiz görev tipi." }, { status: 400 });
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "Görev açıklaması boş olamaz." }, { status: 400 });

  const result = await runAgentTask({
    customerId: body.customerId || null,
    taskType,
    priority: body.priority || "normal",
    requestedProvider: body.requestedProvider || "auto",
    outputFormat: body.outputFormat || "aksiyon planı",
    prompt,
    createdBy: session.profileId || session.authUserId || null
  });

  return NextResponse.json(result);
}

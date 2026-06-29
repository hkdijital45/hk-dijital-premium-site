import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({
    ok: true,
    mode: "prepared_agent_run",
    agentId: id,
    task: body.task || "HK CEO tarafından ajan çalıştırma",
    nextRoute: "/hk-admin/agent-hub",
    payload: {
      taskType: body.taskType || "workflow_task",
      requestedProvider: body.provider || "auto",
      prompt: body.prompt || "Bu ajan için görev planı, risk ve 7 günlük aksiyon üret."
    }
  });
}

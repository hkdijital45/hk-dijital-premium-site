import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig } from "@/lib/supabase";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";
import { runVirtualAgentById } from "@/lib/ai-workforce";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const companyId = typeof body.companyId === "string" && body.companyId ? body.companyId : null;

  const outcome = await runVirtualAgentById(id, {
    companyId,
    prompt: typeof body.prompt === "string" ? body.prompt : null,
    createdBy: session.profileId || session.authUserId || null
  });

  if ("error" in outcome) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.error === "Ajan bulunamadı." ? 404 : 503 });
  }

  const { agent, result } = outcome;
  return NextResponse.json({
    ok: true,
    agentKey: agent.agent_key,
    runId: result.runId,
    status: result.status,
    selectedProvider: result.selectedProviderLabel,
    finalReport: result.finalReport,
    errorMessage: result.errorMessage
  });
}

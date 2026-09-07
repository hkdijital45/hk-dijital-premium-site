import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig } from "@/lib/supabase";
import { sendToTeamActionPresets, type SendToTeamActionKey } from "@/lib/ai-workforce-schema";
import { runDirectorCommand } from "@/lib/ai-workforce";

// "Send to AI Team" (Yapay Zekâ Ekibine Gönder) — HK Admin's minimal
// integration point into the same real orchestration engine AI Workforce
// uses. Creates a genuine persisted agent_runs job (via runDirectorCommand /
// runAgentTask), not a decorative button. Gated on "musteriler" like the
// rest of the customer profile, not "ai-workforce".
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const actionKey = body.action as SendToTeamActionKey;
  const preset = sendToTeamActionPresets[actionKey];
  if (!preset) {
    return NextResponse.json({ error: "Geçersiz aksiyon.", availableActions: Object.keys(sendToTeamActionPresets) }, { status: 400 });
  }

  const result = await runDirectorCommand({
    prompt: preset.prompt,
    companyId: id,
    taskType: preset.taskType,
    multiAgent: preset.multiAgent,
    createdBy: session.profileId || session.authUserId || null,
    eventType: "send_to_ai_team"
  });

  return NextResponse.json({
    ok: true,
    runId: result.runId,
    status: result.status,
    selectedProvider: result.selectedProviderLabel,
    finalReport: result.finalReport,
    errorMessage: result.errorMessage
  });
}

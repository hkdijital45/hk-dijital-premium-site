import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type AgentRunRow = {
  final_report?: {
    executiveSummary?: string;
    recommendedActions?: string[];
    customerMessageDraft?: string;
    sevenDayPlan?: string[];
  } | null;
  export_payload?: Record<string, unknown> | null;
};

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await params;
  const rows = hasSupabaseConfig()
    ? await supabaseRest<AgentRunRow[]>(`agent_runs?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => [])
    : [];
  const run = rows[0];
  if (!run) return NextResponse.json({ error: "Agent görevi bulunamadı." }, { status: 404 });

  const report = run.final_report || {};
  const actions = (report.recommendedActions || report.sevenDayPlan || []).slice(0, 4);
  const text = [
    "Merhaba, reklam ve dijital performans özetini inceledik.",
    report.customerMessageDraft || report.executiveSummary || "Bu dönem için uygulanabilir aksiyon önerileri hazırlandı.",
    "Bu hafta öncelikli önerilerimiz:",
    ...actions.map((item) => `- ${item}`),
    "Bu değerlendirme garanti içermez; ölçüm ve düzenli optimizasyonla ilerlemeyi öneriyoruz.",
    "İsterseniz bu aksiyonları bu hafta uygulamaya alalım."
  ].filter(Boolean).join("\n");

  const exportPayload = { ...(run.export_payload || {}), whatsappSummary: text, whatsappSummaryStatus: "prepared_payload" };
  if (hasSupabaseConfig()) {
    await supabaseRest(`agent_runs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ export_payload: exportPayload, updated_at: new Date().toISOString() })
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, status: "prepared_payload", text });
}

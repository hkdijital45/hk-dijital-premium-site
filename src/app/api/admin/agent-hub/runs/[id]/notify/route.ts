import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type RunRow = {
  task_type?: string | null;
  final_report?: { executiveSummary?: string; recommendedActions?: string[] } | null;
};

async function sendWebhook(url: string, text: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, content: text })
  });
  if (!response.ok) throw new Error("Webhook bildirimi gönderilemedi.");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const channel = String(body.channel || "slack");
  const webhookUrl = channel === "discord" ? process.env.DISCORD_WEBHOOK_URL : process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return NextResponse.json({ ok: false, status: "not_configured", message: "Bildirim entegrasyonu yapılandırılmadı." });

  const rows = hasSupabaseConfig()
    ? await supabaseRest<RunRow[]>(`agent_runs?id=eq.${encodeURIComponent(id)}&select=task_type,final_report`).catch(() => [])
    : [];
  const run = rows[0];
  if (!run) return NextResponse.json({ error: "Agent görevi bulunamadı." }, { status: 404 });

  const report = run.final_report || {};
  const message = [
    `HK Agent Hub sonucu hazır: ${run.task_type || "agent görevi"}`,
    report.executiveSummary || "Yönetici özeti üretildi.",
    ...(report.recommendedActions || []).slice(0, 3).map((item) => `- ${item}`)
  ].join("\n");

  await sendWebhook(webhookUrl, message);
  return NextResponse.json({ ok: true, status: "sent", channel });
}

import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type RunRow = {
  customer_id?: string | null;
  task_type?: string | null;
  final_report?: { executiveSummary?: string; recommendedActions?: string[]; risks?: string[]; confidence?: number } | null;
};

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  const rows = await supabaseRest<RunRow[]>(`agent_runs?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => []);
  const run = rows[0];
  if (!run) return NextResponse.json({ error: "Agent görevi bulunamadı." }, { status: 404 });
  if (!run.customer_id) return NextResponse.json({ error: "AI Hafızasına kaydetmek için müşteri seçilmiş olmalı." }, { status: 400 });
  const report = run.final_report || {};
  const content = [
    report.executiveSummary || "Agent analizi kaydedildi.",
    "Aksiyonlar:",
    ...(report.recommendedActions || []).map((item) => `- ${item}`),
    "Riskler:",
    ...(report.risks || []).map((item) => `- ${item}`)
  ].join("\n");
  const memoryRows = await supabaseRest("agent_memories", {
    method: "POST",
    body: JSON.stringify({
      company_id: run.customer_id,
      customer_id: run.customer_id,
      memory_type: "analysis_result",
      title: "Kaydedilen Agent Analizi",
      content,
      source_run_id: id,
      impact_score: Math.round(Number(report.confidence || 0.75) * 100),
      tags: [run.task_type || "agent", "kaydedildi"],
      is_active: true
    })
  });
  return NextResponse.json({ ok: true, message: "Bu analiz AI Hafızasına eklendi.", memory: Array.isArray(memoryRows) ? memoryRows[0] : memoryRows });
}

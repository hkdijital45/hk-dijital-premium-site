import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const allowedFormats = new Set(["docx", "pdf", "pptx", "copy_text"]);
type FinalReportPayload = {
  executiveSummary?: string;
  findings?: string[];
  risks?: string[];
  opportunities?: string[];
  recommendedActions?: string[];
  sevenDayPlan?: string[];
  customerMessageDraft?: string;
  internalNotes?: string;
  providerChain?: string[];
};
type AgentRunRow = {
  task_type?: string | null;
  created_at?: string | null;
  output_summary?: string | null;
  provider_chain?: unknown;
  final_report?: FinalReportPayload | null;
  output_payload?: FinalReportPayload | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const format = allowedFormats.has(String(body.format)) ? String(body.format) : "copy_text";
  const rows = hasSupabaseConfig()
    ? await supabaseRest<AgentRunRow[]>(`agent_runs?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => [])
    : [];
  const run = rows[0];
  if (!run) return NextResponse.json({ error: "Agent görevi bulunamadı." }, { status: 404 });
  const finalReport = run.final_report || run.output_payload || {};
  const payload = {
    format,
    status: "export_payload_ready",
    message: format === "copy_text" ? "Kopyalanabilir metin hazırlandı." : "Hazırlık verisi oluşturuldu. Gerçek dosya üretimi için rapor motoruna bağlanabilir.",
    title: `HK Agent Hub - ${run.task_type}`,
    createdAt: run.created_at,
    executiveSummary: finalReport.executiveSummary || run.output_summary || "",
    findings: finalReport.findings || [],
    risks: finalReport.risks || [],
    opportunities: finalReport.opportunities || [],
    recommendedActions: finalReport.recommendedActions || [],
    sevenDayPlan: finalReport.sevenDayPlan || [],
    customerMessageDraft: finalReport.customerMessageDraft || "",
    internalNotes: finalReport.internalNotes || "",
    providerChain: finalReport.providerChain || run.provider_chain || []
  };
  if (hasSupabaseConfig()) {
    await supabaseRest(`agent_runs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ export_payload: payload, updated_at: new Date().toISOString() })
    }).catch(() => null);
  }
  return NextResponse.json({ ok: true, payload });
}

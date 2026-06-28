import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { buildPrintableHtmlReport } from "@/lib/report-export";

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
  customer_id?: string | null;
  output_summary?: string | null;
  provider_chain?: unknown;
  final_report?: FinalReportPayload | null;
  output_payload?: FinalReportPayload | null;
};

function buildPlainText(payload: Record<string, unknown>) {
  const list = (title: string, items: unknown) => [
    title,
    ...(Array.isArray(items) ? items.map((item) => `- ${String(item)}`) : [])
  ].join("\n");
  return [
    String(payload.title || "HK Agent Hub Raporu"),
    "",
    String(payload.executiveSummary || ""),
    "",
    list("Bulgular", payload.findings),
    "",
    list("Riskler", payload.risks),
    "",
    list("Fırsatlar", payload.opportunities),
    "",
    list("Önerilen Aksiyonlar", payload.recommendedActions),
    "",
    list("7 Günlük Plan", payload.sevenDayPlan),
    "",
    String(payload.customerMessageDraft || ""),
    "",
    String(payload.internalNotes || "")
  ].filter(Boolean).join("\n");
}

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
  const basePayload = {
    format,
    title: `HK Agent Hub - ${run.task_type}`,
    createdAt: run.created_at,
    customerId: run.customer_id || null,
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
  const payload = {
    ...basePayload,
    status: format === "pdf" ? "prepared_payload" : format === "pptx" ? "unsupported_but_prepared" : "prepared_payload",
    message:
      format === "copy_text"
        ? "Kopyalanabilir metin hazırlandı."
        : format === "pdf"
          ? "Print-ready HTML/PDF taslağı hazırlandı."
          : format === "docx"
            ? "Word için markdown/metin taslağı hazırlandı."
            : "PowerPoint için slayt içerik taslağı hazırlandı.",
    contentType: format === "pdf" ? "text/html" : format === "pptx" ? "application/json" : "text/markdown",
    text: buildPlainText(basePayload),
    html: format === "pdf" ? buildPrintableHtmlReport({
      title: String(basePayload.title),
      customerName: String(basePayload.customerId || "-"),
      period: String(basePayload.createdAt || "-"),
      summary: String(basePayload.executiveSummary || ""),
      sections: [
        { title: "Bulgular", items: basePayload.findings },
        { title: "Riskler", items: basePayload.risks },
        { title: "Fırsatlar", items: basePayload.opportunities },
        { title: "Öncelikli Aksiyonlar", items: basePayload.recommendedActions },
        { title: "7 Günlük Plan", items: basePayload.sevenDayPlan },
        { title: "Müşteriye Gönderilebilir Özet", text: String(basePayload.customerMessageDraft || "") },
        { title: "İç Notlar", text: String(basePayload.internalNotes || "") }
      ]
    }) : undefined,
    slides: format === "pptx" ? [
      { title: "Yönetici Özeti", bullets: [basePayload.executiveSummary] },
      { title: "Bulgular", bullets: basePayload.findings },
      { title: "Riskler", bullets: basePayload.risks },
      { title: "Aksiyon Planı", bullets: basePayload.recommendedActions },
      { title: "7 Günlük Plan", bullets: basePayload.sevenDayPlan }
    ] : undefined
  };
  if (hasSupabaseConfig()) {
    await supabaseRest(`agent_runs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ export_payload: payload, updated_at: new Date().toISOString() })
    }).catch(() => null);
  }
  return NextResponse.json({ ok: true, payload });
}

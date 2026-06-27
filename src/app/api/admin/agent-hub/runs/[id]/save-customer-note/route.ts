import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type RunRow = {
  customer_id?: string | null;
  final_report?: { executiveSummary?: string; customerMessageDraft?: string; recommendedActions?: string[] } | null;
};

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  const rows = await supabaseRest<RunRow[]>(`agent_runs?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => []);
  const run = rows[0];
  if (!run) return NextResponse.json({ error: "Agent görevi bulunamadı." }, { status: 404 });
  if (!run.customer_id) return NextResponse.json({ error: "Müşteri notu oluşturmak için önce müşteri seçmelisin." }, { status: 400 });
  const report = run.final_report || {};
  const noteRows = await supabaseRest("customer_updates", {
    method: "POST",
    body: JSON.stringify({
      company_id: run.customer_id,
      title: "Agent Hub analiz notu",
      description: [report.executiveSummary, report.customerMessageDraft, ...(report.recommendedActions || []).map((item) => `- ${item}`)].filter(Boolean).join("\n"),
      update_type: "Agent Analizi",
      visible_to_customer: false
    })
  });
  return NextResponse.json({ ok: true, message: "Analiz müşteri notu olarak kaydedildi.", note: Array.isArray(noteRows) ? noteRows[0] : noteRows });
}

import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type AgentRunRow = {
  customer_id?: string | null;
  final_report?: {
    customerMessageDraft?: string;
    recommendedActions?: string[];
  } | null;
};
type CompanyRow = { email?: string | null; contact_email?: string | null; company_email?: string | null };

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await params;
  const rows = hasSupabaseConfig()
    ? await supabaseRest<AgentRunRow[]>(`agent_runs?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => [])
    : [];
  const run = rows[0];
  if (!run) return NextResponse.json({ error: "Agent görevi bulunamadı." }, { status: 404 });
  const companyRows = run.customer_id && hasSupabaseConfig()
    ? await supabaseRest<CompanyRow[]>(`companies?id=eq.${encodeURIComponent(run.customer_id)}&select=email,contact_email,company_email`).catch(() => [])
    : [];
  const customerEmail = companyRows[0]?.email || companyRows[0]?.contact_email || companyRows[0]?.company_email || null;
  const finalReport = run.final_report || {};
  const draft = {
    subject: "HK Dijital analiz ve aksiyon önerileri",
    body: [
      "Merhaba,",
      "",
      finalReport.customerMessageDraft || "Mevcut verileri inceledik ve ölçülü aksiyon önerileri hazırladık.",
      "",
      "Aşağıdaki aksiyonları öneriyoruz:",
      ...(finalReport.recommendedActions || []).map((item: string) => `- ${item}`),
      "",
      "Bu değerlendirme satış garantisi içermez; performansı düzenli ölçerek ilerlemeyi öneriyoruz.",
      "",
      "HK Dijital"
    ].join("\n"),
    customerEmail,
    status: customerEmail ? "draft_ready" : "missing_email"
  };
  if (hasSupabaseConfig()) {
    await supabaseRest(`agent_runs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ email_draft: draft, updated_at: new Date().toISOString() })
    }).catch(() => null);
  }
  return NextResponse.json({ ok: true, draft });
}

import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

type RunRow = {
  customer_id?: string | null;
  final_report?: { recommendedActions?: string[]; executiveSummary?: string } | null;
};

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 503 });
  const { id } = await params;
  const rows = await supabaseRest<RunRow[]>(`agent_runs?id=eq.${encodeURIComponent(id)}&select=*`).catch(() => []);
  const run = rows[0];
  if (!run) return NextResponse.json({ error: "Agent görevi bulunamadı." }, { status: 404 });
  if (!run.customer_id) return NextResponse.json({ error: "Göreve dönüştürmek için önce müşteri seçmelisin." }, { status: 400 });
  const report = run.final_report || {};
  const actions = report.recommendedActions?.length ? report.recommendedActions : ["Agent analizindeki önerileri kontrol et ve uygulanacak aksiyonları planla."];
  const taskRows = await supabaseRest("agency_tasks", {
    method: "POST",
    body: JSON.stringify({
      company_id: run.customer_id,
      title: `Agent aksiyonu: ${actions[0].slice(0, 80)}`,
      description: [report.executiveSummary, ...actions.map((item) => `- ${item}`)].filter(Boolean).join("\n"),
      status: "Yapılacak",
      priority: "Yüksek",
      due_date: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      visible_to_customer: false,
      automation_key: `agent-run-${id}`
    })
  });
  return NextResponse.json({ ok: true, message: "Agent sonucu göreve dönüştürüldü.", task: Array.isArray(taskRows) ? taskRows[0] : taskRows });
}

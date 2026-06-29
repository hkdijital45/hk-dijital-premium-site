/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

function packagePayload(body: Record<string, any>, createdBy?: string | null) {
  return {
    package_name: body.package_name || body.packageName || `${body.sector || "Sektör"} Paketi`,
    sector: body.sector || "Sektör",
    target_customer: body.target_customer || body.targetCustomer || null,
    service_types: body.service_types || body.serviceTypes || [],
    channels: body.channels || [],
    monthly_budget_range: body.monthly_budget_range || body.monthlyBudgetRange || null,
    main_goal: body.main_goal || body.mainGoal || null,
    generated_prompt: body.generated_prompt || body.generatedPrompt || null,
    workflow_steps: body.workflow_steps || body.workflowSteps || [],
    ai_team: body.ai_team || body.aiTeam || [],
    kpi_template: body.kpi_template || body.kpiTemplate || [],
    report_template: body.report_template || body.reportTemplate || [],
    proposal_draft: body.proposal_draft || body.proposalDraft || null,
    operation_plan: body.operation_plan || body.operationPlan || [],
    status: body.status || "draft",
    created_by: createdBy || null,
    updated_at: new Date().toISOString()
  };
}

export async function GET() {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ packages: [], warning: "Supabase bağlantısı yok; kayıtlar hazırlık modunda." });
  const rows = await supabaseRest<any[]>("hk_marketplace_packages?select=*&order=created_at.desc&limit=100").catch(() => []);
  return NextResponse.json({ packages: rows });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  try {
    const rows = await supabaseRest<any[]>("hk_marketplace_packages", {
      method: "POST",
      body: JSON.stringify(packagePayload(body, session.profileId || session.authUserId || null))
    });
    return NextResponse.json({ ok: true, package: rows[0], message: "Marketplace paketi kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

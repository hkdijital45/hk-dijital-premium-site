/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const defaultOptions = {
  saveMemory: true,
  createCustomerNote: true,
  createTasks: true,
  createWorkflowDraft: true,
  createKpiTemplate: true,
  createReportTemplate: true,
  createProposalDraft: true
};

function asArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function packageField(pkg: Record<string, any>, snake: string, camel: string, fallback: any = "") {
  return pkg[snake] ?? pkg[camel] ?? fallback;
}

function taskTitles(pkg: Record<string, any>) {
  const plan = asArray(packageField(pkg, "operation_plan", "operationPlan", []));
  const generated = plan.length ? plan : [
    "Entegrasyon bilgilerini kontrol et",
    "Meta Pixel / Dataset doğrula",
    "GA4 ve Search Console kontrol et",
    "İlk kampanya yapısını incele",
    "İlk kreatif öneri setini hazırla",
    "7 günlük reklam sağlık raporu oluştur",
    "İlk müşteri raporunu hazırla"
  ];
  return generated.slice(0, 8);
}

async function safeInsert(table: string, body: unknown) {
  return supabaseRest<any[]>(table, { method: "POST", body: JSON.stringify(body) }).catch((error) => ({ error }));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || body.company_id || "");
  if (!companyId) return NextResponse.json({ error: "Paketi uygulamak için müşteri seçin." }, { status: 400 });

  const options = { ...defaultOptions, ...(body.options || {}) };
  const packageRows = hasSupabaseConfig() && id !== "prepared"
    ? await supabaseRest<any[]>(`hk_marketplace_packages?id=eq.${encodeURIComponent(id)}&select=*&limit=1`).catch(() => [])
    : [];
  const pkg = packageRows[0] || body.package || {};
  const packageName = packageField(pkg, "package_name", "packageName", "Marketplace Paketi");
  const sector = packageField(pkg, "sector", "sector", "Sektör");
  const prompt = packageField(pkg, "generated_prompt", "generatedPrompt", "");
  const workflow = asArray(packageField(pkg, "workflow_steps", "workflowSteps", []));
  const aiTeam = asArray(packageField(pkg, "ai_team", "aiTeam", []));
  const kpis = asArray(packageField(pkg, "kpi_template", "kpiTemplate", []));
  const reports = asArray(packageField(pkg, "report_template", "reportTemplate", []));
  const proposal = packageField(pkg, "proposal_draft", "proposalDraft", "");
  const plan = taskTitles(pkg);
  const createdRecords: Record<string, unknown> = {};
  const resultSummary = {
    packageName,
    sector,
    memory: 0,
    customerNote: 0,
    tasks: 0,
    workflowDraft: 0,
    kpiTemplate: options.createKpiTemplate ? 1 : 0,
    reportTemplate: options.createReportTemplate ? 1 : 0,
    proposalDraft: options.createProposalDraft ? 1 : 0
  };

  if (!hasSupabaseConfig()) {
    return NextResponse.json({
      ok: true,
      mode: "prepared_payload",
      message: `${packageName} paketi seçilen müşteri için hazırlık payload’ı olarak üretildi.`,
      summary: resultSummary,
      payload: { packageId: id, companyId, options, package: pkg, tasks: plan, workflow, kpis, reports, proposal }
    });
  }

  try {
    if (options.saveMemory) {
      const memory = await safeInsert("agent_memories", {
        company_id: companyId,
        memory_type: "marketplace_package",
        title: `${packageName}`,
        content: [prompt, `Operasyon planı: ${plan.join(" | ")}`, `AI Team: ${aiTeam.join(", ")}`].filter(Boolean).join("\n"),
        tags: ["marketplace", "hk-ceo", sector],
        is_active: true
      });
      if (Array.isArray(memory)) { resultSummary.memory = 1; createdRecords.memory = memory[0]?.id || true; }
    }

    if (options.createCustomerNote) {
      const note = await safeInsert("customer_updates", {
        company_id: companyId,
        title: `${packageName} uygulandı`,
        description: `${packageName} bu müşteri için uygulandı. İlk 30 günlük operasyon planı, KPI ve rapor şablonu hazırlandı.`,
        update_type: "Strateji Notu",
        visible_to_customer: false
      });
      if (Array.isArray(note)) { resultSummary.customerNote = 1; createdRecords.customerNote = note[0]?.id || true; }
    }

    if (options.createTasks) {
      const dueBase = Date.now();
      const tasks = await safeInsert("agency_tasks", plan.map((title, index) => ({
        company_id: companyId,
        title,
        description: `${packageName} uygulama planı görevi. Kaynak: HK Intelligence CEO Marketplace.`,
        status: "Yapılacak",
        priority: index < 2 ? "Yüksek" : "Normal",
        due_date: new Date(dueBase + (index + 1) * 86400000).toISOString().slice(0, 10),
        visible_to_customer: false
      })));
      if (Array.isArray(tasks)) { resultSummary.tasks = tasks.length; createdRecords.tasks = tasks.map((task) => task.id).filter(Boolean); }
    }

    if (options.createWorkflowDraft) {
      const workflowRows = await safeInsert("agent_workflows", {
        name: `${packageName} workflow taslağı`,
        description: `${sector} paketi müşteri uygulama workflow taslağı.`,
        steps: workflow.length ? workflow : plan,
        is_active: false
      });
      if (Array.isArray(workflowRows)) { resultSummary.workflowDraft = 1; createdRecords.workflowDraft = workflowRows[0]?.id || true; }
    }

    const applicationRows = await safeInsert("hk_marketplace_package_applications", {
      package_id: id === "prepared" ? null : id,
      company_id: companyId,
      status: "applied",
      options,
      result_summary: resultSummary,
      created_records: {
        ...createdRecords,
        kpiTemplate: options.createKpiTemplate ? kpis : [],
        reportTemplate: options.createReportTemplate ? reports : [],
        proposalDraft: options.createProposalDraft ? proposal : null,
        workflowPayload: workflow
      },
      created_by: session.profileId || session.authUserId || null
    });

    const application = Array.isArray(applicationRows) ? applicationRows[0] : null;
    return NextResponse.json({
      ok: true,
      mode: "applied",
      message: `${packageName} paketi müşteriye uygulandı.`,
      summary: resultSummary,
      createdRecords,
      application
    });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await safeInsert("hk_marketplace_package_applications", {
      package_id: id === "prepared" ? null : id,
      company_id: companyId,
      status: "failed",
      options,
      result_summary: resultSummary,
      created_records: createdRecords,
      error_message: safe.detail,
      created_by: session.profileId || session.authUserId || null
    }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail, summary: resultSummary, createdRecords }, { status: 500 });
  }
}

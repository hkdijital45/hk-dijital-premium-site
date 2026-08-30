import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

// Deterministic aggregation first (spec section 28: never hand the LLM a raw
// database dump) — only the compact summary below goes to the AI call.
async function aggregateDailySignals() {
  const today = todayIso();

  const [overduePayments, overdueTasks, todaysTasks, openRisks, topOpportunities, riskyCustomers] = await Promise.all([
    safeFetch<Array<{ id: string; company_id: string; amount: number; due_date: string }>>(
      `payment_records?status=eq.Bekliyor&due_date=lt.${today}&select=id,company_id,amount,due_date&order=due_date.asc&limit=100`,
      []
    ),
    safeFetch<Array<{ id: string; company_id: string; title: string; due_date: string }>>(
      `agency_tasks?status=neq.Tamamlandı&completed_at=is.null&due_date=lt.${today}&select=id,company_id,title,due_date&order=due_date.asc&limit=100`,
      []
    ),
    safeFetch<Array<{ id: string; company_id: string; title: string }>>(
      `agency_tasks?status=neq.Tamamlandı&completed_at=is.null&due_date=eq.${today}&select=id,company_id,title&limit=100`,
      []
    ),
    safeFetch<Array<{ id: string; company_id: string; title: string; severity: string }>>(
      `hk_risk_events?status=eq.open&select=id,company_id,title,severity&order=severity.desc&limit=10`,
      []
    ),
    safeFetch<Array<{ id: string; query: string; opportunity_score: number; recommended_action: string }>>(
      `growth_opportunities?status=eq.new&select=id,query,opportunity_score,recommended_action&order=opportunity_score.desc&limit=5`,
      []
    ),
    safeFetch<Array<{ id: string; company_id: string; score: number; risk_level: string; calculated_at: string }>>(
      `customer_risk_scores?risk_level=in.(risky,critical)&select=id,company_id,score,risk_level,calculated_at&order=calculated_at.desc&limit=40`,
      []
    )
  ]);

  const seenCompanies = new Set<string>();
  const latestRiskyCustomers = riskyCustomers.filter((row) => {
    if (seenCompanies.has(row.company_id)) return false;
    seenCompanies.add(row.company_id);
    return true;
  }).slice(0, 5);

  const overduePaymentTotal = overduePayments.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  return {
    today,
    overduePayments,
    overduePaymentTotal,
    overdueTasks,
    todaysTasks,
    openRisks,
    topOpportunities,
    riskyCustomers: latestRiskyCustomers
  };
}

function buildDeterministicSections(signals: Awaited<ReturnType<typeof aggregateDailySignals>>) {
  const riskAlerts = [
    ...signals.openRisks.map((risk) => ({ type: "operational_risk", title: risk.title, severity: risk.severity, companyId: risk.company_id })),
    ...signals.riskyCustomers.map((risk) => ({ type: "customer_risk", title: `Müşteri riski: skor ${risk.score}/100 (${risk.risk_level})`, severity: risk.risk_level === "critical" ? "critical" : "warning", companyId: risk.company_id }))
  ].slice(0, 10);

  const opportunities = signals.topOpportunities.map((item) => ({
    title: item.query,
    action: item.recommended_action,
    score: item.opportunity_score
  }));

  return { riskAlerts, opportunities };
}

export async function generateCeoBriefing(triggeredBy: "cron" | "manual" = "manual") {
  const briefingDate = todayIso();

  const existing = await safeFetch<Array<{ id: string }>>(`ceo_briefings?briefing_date=eq.${briefingDate}&select=id&limit=1`, []);
  if (existing.length) {
    const rows = await supabaseRest<Array<Record<string, unknown>>>(`ceo_briefings?briefing_date=eq.${briefingDate}&select=*&limit=1`);
    return { ok: true, briefing: rows[0], alreadyGenerated: true };
  }

  const signals = await aggregateDailySignals();
  const { riskAlerts, opportunities } = buildDeterministicSections(signals);

  const promptSummary = [
    `Tarih: ${signals.today}`,
    `Geciken tahsilat: ${signals.overduePayments.length} kayıt, toplam ${signals.overduePaymentTotal.toFixed(0)} TL.`,
    `Geciken görev: ${signals.overdueTasks.length}.`,
    `Bugünün görevleri: ${signals.todaysTasks.length}.`,
    `Açık operasyonel risk: ${signals.openRisks.map((risk) => risk.title).join("; ") || "yok"}.`,
    `Riskli/kritik müşteri sayısı: ${signals.riskyCustomers.length}.`,
    `En yüksek SEO/GEO fırsatı: ${opportunities[0]?.title || "yok"}.`
  ].join("\n");

  const ai = await executeAiTask({
    taskType: "strategy",
    module: "CEO Briefing",
    endpoint: "/api/admin/ceo-briefing/run-daily",
    prompt: `Aşağıdaki günlük ajans verisinden, HK Dijital yöneticisi için kısa (max 120 kelime) bir yönetici özeti yaz. En kritik 3 konuyu, varsa fırsatları ve önerilen ilk aksiyonu belirt. Abartılı dil kullanma, satış garantisi verme.\n\n${promptSummary}`,
    expectedOutput: "3-5 cümlelik yönetici özeti",
    fallbackText: `Bugün için ${signals.overdueTasks.length} geciken görev, ${signals.overduePayments.length} geciken tahsilat ve ${signals.riskyCustomers.length} riskli müşteri tespit edildi. Önce geciken tahsilatları ve açık riskleri gözden geçirin.`,
    createdBy: null
  }, { cacheTtlMs: 0, recordExecution: true });

  const summary_json = {
    overduePaymentCount: signals.overduePayments.length,
    overduePaymentTotal: signals.overduePaymentTotal,
    overdueTaskCount: signals.overdueTasks.length,
    todaysTaskCount: signals.todaysTasks.length,
    openRiskCount: signals.openRisks.length,
    riskyCustomerCount: signals.riskyCustomers.length
  };

  const aiInsights = [
    signals.overdueTasks.length ? `${signals.overdueTasks.length} geciken görev var.` : null,
    signals.overduePayments.length ? `${signals.overduePayments.length} geciken tahsilat, toplam ${signals.overduePaymentTotal.toFixed(0)} TL.` : null,
    signals.riskyCustomers.length ? `${signals.riskyCustomers.length} müşteri risk/kritik seviyesinde.` : null
  ].filter((item): item is string => Boolean(item));

  const inserted = await supabaseRest<Array<Record<string, unknown>>>("ceo_briefings", {
    method: "POST",
    body: JSON.stringify({
      briefing_date: briefingDate,
      summary_json,
      executive_summary: ai.text,
      ai_insights: aiInsights,
      risk_alerts: riskAlerts,
      opportunities,
      generated_at: new Date().toISOString(),
      delivery_status: "generated",
      delivery_channels: [],
      generation_version: "v1"
    })
  });

  return { ok: true, briefing: inserted[0], alreadyGenerated: false, aiProvider: ai.provider, triggeredBy };
}

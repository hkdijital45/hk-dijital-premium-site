import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";

const WON_LIKE = ["Kazanıldı", "Kazandı", "Dönüştürüldü", "Müşteri Oldu"];
const LOST_LIKE = ["Kaybedildi", "Reddedildi"];
const PAID_LIKE = ["Ödendi", "Tahsil Edildi"];

function monthsAgoIso(months: number) {
  return new Date(Date.now() - months * 30 * 86_400_000).toISOString().slice(0, 10);
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

function leadStageProbability(lead: { status: string; proposal_status: string | null; proposal_amount: number | null }) {
  const status = String(lead.proposal_status || lead.status || "");
  if (status.includes("Teklif")) return 0.55;
  if (status.includes("Görüşme") || status.includes("İletişim")) return 0.25;
  return 0.1;
}

export async function generateCashFlowForecast(periodMonths = 3, createdBy: string | null = null) {
  const [paidPayments, expenses, openLeads] = await Promise.all([
    safeFetch<Array<{ amount: number; payment_date: string | null; status: string }>>(
      `payment_records?status=in.(${PAID_LIKE.map((s) => encodeURIComponent(s)).join(",")})&payment_date=gte.${monthsAgoIso(3)}&select=amount,payment_date,status&limit=1000`,
      []
    ),
    safeFetch<Array<{ amount: number; expense_date: string | null }>>(
      `agency_expenses?expense_date=gte.${monthsAgoIso(3)}&select=amount,expense_date&limit=1000`,
      []
    ),
    safeFetch<Array<{ status: string; proposal_status: string | null; proposal_amount: number | null }>>(
      "leads?select=status,proposal_status,proposal_amount&limit=2000",
      []
    )
  ]);

  const monthlyRecurring = paidPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0) / 3;
  const monthlyExpenses = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0) / 3;

  const pipelineLeads = openLeads.filter((lead) => !WON_LIKE.includes(lead.status) && !LOST_LIKE.includes(lead.status));
  const pipelineValue = pipelineLeads.reduce((sum, lead) => sum + Number(lead.proposal_amount || 0) * leadStageProbability(lead), 0);

  const scenarios = {
    conservative: { revenueMultiplier: 0.9, pipelineMultiplier: 0.6 },
    base: { revenueMultiplier: 1.0, pipelineMultiplier: 1.0 },
    optimistic: { revenueMultiplier: 1.05, pipelineMultiplier: 1.3 }
  } as const;

  const results = [];
  for (const [scenarioName, weights] of Object.entries(scenarios) as Array<[keyof typeof scenarios, typeof scenarios["base"]]>) {
    const projectedRevenue = Math.round((monthlyRecurring * weights.revenueMultiplier + pipelineValue * weights.pipelineMultiplier) * periodMonths);
    const projectedExpenses = Math.round(monthlyExpenses * periodMonths);
    const projectedNet = projectedRevenue - projectedExpenses;

    const inserted = await supabaseRest<Array<Record<string, unknown>>>("cash_flow_forecasts", {
      method: "POST",
      body: JSON.stringify({
        period_months: periodMonths,
        scenario: scenarioName,
        projected_revenue: projectedRevenue,
        projected_expenses: projectedExpenses,
        projected_net: projectedNet,
        breakdown: { monthlyRecurring: Math.round(monthlyRecurring), pipelineValue: Math.round(pipelineValue), monthlyExpenses: Math.round(monthlyExpenses), pipelineLeadCount: pipelineLeads.length },
        created_by: createdBy
      })
    });
    results.push(inserted[0]);
  }

  const base = results.find((row) => row.scenario === "base");
  const ai = await executeAiTask({
    taskType: "strategy",
    module: "Cash Flow Forecast",
    endpoint: "/api/admin/cash-flow/forecast",
    prompt: `${periodMonths} aylık nakit akışı tahmini: temel senaryo net ${base?.projected_net} TL (gelir ${base?.projected_revenue} TL, gider ${base?.projected_expenses} TL). Bu tahmin için 2-3 cümlelik yönetici yorumu ve dikkat edilmesi gereken risk yaz.`,
    expectedOutput: "2-3 cümlelik yönetici yorumu",
    fallbackText: "Tahmin, son 3 ayın tahsilat ve gider ortalamasına dayanmaktadır. Pipeline'daki büyük tekliflerin kapanış durumunu yakından izleyin.",
    createdBy
  }, { cacheTtlMs: 10 * 60_000 });

  return { ok: true, scenarios: results, executiveSummary: ai.text };
}

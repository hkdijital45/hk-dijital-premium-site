import "server-only";
import { supabaseRest } from "@/lib/supabase";

// Distinct from customer-risk-engine.ts: Risk Score = churn likelihood
// (higher = worse). Health Score here = overall relationship quality
// (higher = better). Intentionally not merged into one table/service since
// they answer different questions, per the "don't duplicate risk vs health"
// rule this was built under — but they do share the same fetch shape for
// payment/task/ad signals, mirrored here rather than abstracted to avoid
// touching the already-shipped, tested risk engine.
const WEIGHTS = { payment: 30, task: 25, communication: 20, marketing: 15, satisfaction: 10 } as const;
type Factor = keyof typeof WEIGHTS;
type FactorValues = Partial<Record<Factor, number>>;

function healthLevelFor(score: number): "critical" | "at_risk" | "good" | "excellent" {
  if (score < 40) return "critical";
  if (score < 65) return "at_risk";
  if (score < 85) return "good";
  return "excellent";
}

function weightedAverage(values: FactorValues) {
  const entries = Object.entries(values).filter(([, value]) => value !== null && value !== undefined) as Array<[Factor, number]>;
  if (!entries.length) return null;
  const totalWeight = entries.reduce((sum, [factor]) => sum + WEIGHTS[factor], 0);
  const weighted = entries.reduce((sum, [factor, value]) => sum + value * WEIGHTS[factor], 0);
  return weighted / totalWeight;
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

async function ensureNoDuplicateHealthTask(companyId: string) {
  const open = await safeFetch<Array<{ id: string }>>(
    `agency_tasks?company_id=eq.${companyId}&automation_key=like.customer-health-${companyId}%25&completed_at=is.null&select=id&limit=1`,
    []
  );
  return open.length === 0;
}

export async function calculateCustomerHealthScores(triggeredBy: "cron" | "manual" = "manual") {
  const today = new Date().toISOString().slice(0, 10);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();

  const [companies, overduePayments, tasks, adInterpretations, staleConversations, allConversations] = await Promise.all([
    safeFetch<Array<{ id: string }>>("companies?status=eq.Aktif&select=id&limit=500", []),
    safeFetch<Array<{ company_id: string }>>(`payment_records?status=eq.Bekliyor&due_date=lt.${today}&select=company_id&limit=2000`, []),
    safeFetch<Array<{ company_id: string; due_date: string | null; completed_at: string | null }>>(
      "agency_tasks?select=company_id,due_date,completed_at&limit=3000",
      []
    ),
    safeFetch<Array<{ customer_id: string; health_score: number; created_at: string }>>(
      `ad_ai_interpretations?created_at=gte.${sixtyDaysAgo}&select=customer_id,health_score,created_at&order=created_at.desc&limit=1000`,
      []
    ),
    safeFetch<Array<{ company_id: string }>>(
      `customer_conversations?status=eq.admin_reply_required&last_message_at=lt.${twoDaysAgo}&select=company_id&limit=1000`,
      []
    ),
    safeFetch<Array<{ company_id: string }>>("customer_conversations?select=company_id&limit=3000", [])
  ]);

  const latestAdHealthByCompany = new Map<string, number>();
  for (const row of adInterpretations) {
    if (!latestAdHealthByCompany.has(row.customer_id)) latestAdHealthByCompany.set(row.customer_id, row.health_score);
  }
  const hasConversationHistory = new Set(allConversations.map((row) => row.company_id));
  const staleByCompany = new Map<string, number>();
  for (const row of staleConversations) staleByCompany.set(row.company_id, (staleByCompany.get(row.company_id) || 0) + 1);

  const results: Array<{ companyId: string; score: number; healthLevel: string }> = [];

  for (const company of companies) {
    const companyOverdue = overduePayments.filter((row) => row.company_id === company.id).length;
    const companyTasks = tasks.filter((row) => row.company_id === company.id);
    const overdueTasks = companyTasks.filter((row) => !row.completed_at && row.due_date && row.due_date < today);

    const paymentHealth = companyOverdue === 0 ? 100 : Math.max(0, 100 - companyOverdue * 30);
    const taskHealth = companyTasks.length === 0 ? null : Math.max(0, 100 - (overdueTasks.length / companyTasks.length) * 150);
    const communicationHealth = hasConversationHistory.has(company.id) ? Math.max(0, 100 - (staleByCompany.get(company.id) || 0) * 35) : null;
    const marketingHealth = latestAdHealthByCompany.has(company.id) ? latestAdHealthByCompany.get(company.id)! : null;
    const satisfactionHealth = null; // no survey/NPS data source exists yet

    const factors: FactorValues = {
      payment: paymentHealth,
      task: taskHealth ?? undefined,
      communication: communicationHealth ?? undefined,
      marketing: marketingHealth ?? undefined,
      satisfaction: satisfactionHealth ?? undefined
    };

    const average = weightedAverage(factors);
    if (average === null) continue;

    const score = Math.round(Math.min(100, Math.max(0, average)));
    const healthLevel = healthLevelFor(score);

    const previous = await safeFetch<Array<{ score: number }>>(
      `customer_health_scores?company_id=eq.${company.id}&select=score&order=calculated_at.desc&limit=1`,
      []
    );
    const previousScore = previous[0]?.score ?? null;
    const trend = previousScore === null ? "stable" : score > previousScore + 5 ? "improving" : score < previousScore - 5 ? "worsening" : "stable";

    await supabaseRest("customer_health_scores", {
      method: "POST",
      body: JSON.stringify({
        company_id: company.id,
        score,
        health_level: healthLevel,
        factors_json: factors,
        previous_score: previousScore,
        trend,
        calculated_at: new Date().toISOString(),
        source_version: "v1"
      })
    });

    if (score < 50) {
      const canCreate = await ensureNoDuplicateHealthTask(company.id);
      if (canCreate) {
        await supabaseRest("agency_tasks", {
          method: "POST",
          body: JSON.stringify({
            company_id: company.id,
            title: `Müşteri sağlık skoru düşük (${score}/100) — ilişki gözden geçirme`,
            description: "Otomatik health engine tarafından oluşturuldu.",
            status: "Yapılacak",
            priority: "Normal",
            due_date: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10),
            automation_key: `customer-health-${company.id}-${Date.now()}`
          })
        }).catch(() => null);
      }
    }

    results.push({ companyId: company.id, score, healthLevel });
  }

  return { ok: true, triggeredBy, evaluated: results.length, results };
}

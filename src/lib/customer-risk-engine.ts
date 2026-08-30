import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";

const WEIGHTS = { payment: 30, engagement: 25, task: 20, ad: 15, satisfaction: 10 } as const;

type Factor = keyof typeof WEIGHTS;
type FactorValues = Partial<Record<Factor, number>>;

function riskLevelFor(score: number): "safe" | "attention" | "risky" | "critical" {
  if (score <= 30) return "safe";
  if (score <= 60) return "attention";
  if (score <= 85) return "risky";
  return "critical";
}

function daysSince(dateIso: string | null) {
  if (!dateIso) return null;
  return Math.floor((Date.now() - new Date(dateIso).getTime()) / 86_400_000);
}

function engagementHealthFromDays(days: number | null) {
  if (days === null) return null;
  if (days <= 7) return 100;
  if (days <= 14) return 75;
  if (days <= 30) return 50;
  if (days <= 60) return 25;
  return 0;
}

// Only averages the factors that actually have data — missing signals are
// excluded and remaining weights renormalized, per spec section 8 ("eksik
// veri varsa skoru yanlış biçimde cezalandırma").
function weightedHealth(values: FactorValues) {
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

async function ensureNoDuplicateRetentionTask(companyId: string) {
  const open = await safeFetch<Array<{ id: string }>>(
    `agency_tasks?company_id=eq.${companyId}&automation_key=like.customer-retention-${companyId}%25&completed_at=is.null&select=id&limit=1`,
    []
  );
  return open.length === 0;
}

async function ensureNoDuplicateRiskEvent(companyId: string) {
  const open = await safeFetch<Array<{ id: string }>>(
    `hk_risk_events?company_id=eq.${companyId}&risk_key=eq.customer_risk_high&status=eq.open&select=id&limit=1`,
    []
  );
  return open.length === 0;
}

async function createRetentionFollowUp(companyId: string, score: number, factors: FactorValues) {
  const canCreateTask = await ensureNoDuplicateRetentionTask(companyId);
  if (canCreateTask) {
    const dueDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await supabaseRest("agency_tasks", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        title: `Müşteri risk skoru yüksek (${score}/100) — elde tutma görüşmesi`,
        description: "Otomatik risk motoru tarafından oluşturuldu. Ödeme, görev ve reklam performansı sinyalleri riskli seviyede.",
        status: "Yapılacak",
        priority: "Yüksek",
        due_date: dueDate,
        automation_key: `customer-retention-${companyId}-${Date.now()}`
      })
    }).catch(() => null);
  }

  const canCreateRiskEvent = await ensureNoDuplicateRiskEvent(companyId);
  if (canCreateRiskEvent) {
    const ai = await executeAiTask({
      taskType: "quick_summary",
      module: "Customer Risk Engine",
      endpoint: "/api/admin/customer-risk/run-daily",
      prompt: `Müşteri risk skoru ${score}/100 (kritik eşik aşıldı). Faktörler: ${JSON.stringify(factors)}. Bu müşteri için 1-2 cümlelik kısa risk açıklaması ve tavsiye edilen aksiyon yaz.`,
      expectedOutput: "1-2 cümle risk özeti ve aksiyon önerisi",
      fallbackText: "Ödeme, görev veya reklam performansı sinyallerinde bozulma tespit edildi. Müşteriyle kısa bir durum görüşmesi planlanması önerilir.",
      createdBy: null
    }, { cacheTtlMs: 0 }).catch(() => null);

    await supabaseRest("hk_risk_events", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        risk_key: "customer_risk_high",
        title: `Müşteri risk skoru: ${score}/100`,
        severity: score >= 86 ? "critical" : "warning",
        source_module: "customer-risk-engine",
        status: "open",
        recommendation: ai?.text || null,
        metadata: { score, factors }
      })
    }).catch(() => null);
  }
}

export async function calculateCustomerRiskScores(triggeredBy: "cron" | "manual" = "manual") {
  const today = new Date().toISOString().slice(0, 10);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();

  const [companies, overduePayments, tasks, adInterpretations] = await Promise.all([
    safeFetch<Array<{ id: string; name: string }>>("companies?status=eq.Aktif&select=id,name&limit=500", []),
    safeFetch<Array<{ company_id: string; amount: number }>>(`payment_records?status=eq.Bekliyor&due_date=lt.${today}&select=company_id,amount&limit=2000`, []),
    safeFetch<Array<{ company_id: string; due_date: string | null; completed_at: string | null; updated_at: string }>>(
      `agency_tasks?select=company_id,due_date,completed_at,updated_at&order=updated_at.desc&limit=3000`,
      []
    ),
    safeFetch<Array<{ customer_id: string; health_score: number; created_at: string }>>(
      `ad_ai_interpretations?created_at=gte.${sixtyDaysAgo}&select=customer_id,health_score,created_at&order=created_at.desc&limit=1000`,
      []
    )
  ]);

  const latestAdHealthByCompany = new Map<string, number>();
  for (const row of adInterpretations) {
    if (!latestAdHealthByCompany.has(row.customer_id)) latestAdHealthByCompany.set(row.customer_id, row.health_score);
  }

  const results: Array<{ companyId: string; score: number; riskLevel: string; alertTriggered: boolean }> = [];

  for (const company of companies) {
    const companyPayments = overduePayments.filter((row) => row.company_id === company.id);
    const companyTasks = tasks.filter((row) => row.company_id === company.id);
    const overdueTasks = companyTasks.filter((row) => !row.completed_at && row.due_date && row.due_date < today);
    const lastActivityAt = companyTasks[0]?.updated_at || null;

    const paymentHealth = companyPayments.length === 0 ? 100 : Math.max(0, 100 - companyPayments.length * 30);
    const taskHealth = companyTasks.length === 0 ? null : Math.max(0, 100 - (overdueTasks.length / companyTasks.length) * 150);
    const engagementHealth = engagementHealthFromDays(daysSince(lastActivityAt));
    const adHealth = latestAdHealthByCompany.has(company.id) ? latestAdHealthByCompany.get(company.id)! : null;
    const satisfactionHealth = null; // no data source exists yet — always excluded, weight renormalized

    const factors: FactorValues = { payment: paymentHealth, engagement: engagementHealth ?? undefined, task: taskHealth ?? undefined, ad: adHealth ?? undefined, satisfaction: satisfactionHealth ?? undefined };
    const health = weightedHealth(factors);
    if (health === null) continue;

    const score = Math.round(Math.min(100, Math.max(0, 100 - health)));
    const riskLevel = riskLevelFor(score);
    const alertTriggered = score > 70;

    const previous = await safeFetch<Array<{ score: number }>>(
      `customer_risk_scores?company_id=eq.${company.id}&select=score&order=calculated_at.desc&limit=1`,
      []
    );
    const previousScore = previous[0]?.score ?? null;
    const trend = previousScore === null ? "stable" : score > previousScore + 5 ? "worsening" : score < previousScore - 5 ? "improving" : "stable";

    await supabaseRest("customer_risk_scores", {
      method: "POST",
      body: JSON.stringify({
        company_id: company.id,
        score,
        risk_level: riskLevel,
        factors_json: factors,
        previous_score: previousScore,
        trend,
        calculated_at: new Date().toISOString(),
        alert_triggered: alertTriggered,
        source_version: "v1"
      })
    });

    if (alertTriggered) await createRetentionFollowUp(company.id, score, factors).catch(() => null);

    results.push({ companyId: company.id, score, riskLevel, alertTriggered });
  }

  return { ok: true, triggeredBy, evaluated: results.length, alerts: results.filter((row) => row.alertTriggered).length, results };
}

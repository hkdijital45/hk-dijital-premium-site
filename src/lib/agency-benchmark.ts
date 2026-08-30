import "server-only";
import { supabaseRest } from "@/lib/supabase";

const WON_LIKE = ["Kazanıldı", "Kazandı", "Dönüştürüldü", "Müşteri Oldu"];
const LOST_LIKE = ["Kaybedildi", "Reddedildi"];
const PAID_LIKE = ["Ödendi", "Tahsil Edildi"];

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

async function computePeriodMetrics(periodStart: string, periodEnd: string) {
  const [payments, leads, completedTasks, activeCompanies, riskScores] = await Promise.all([
    safeFetch<Array<{ amount: number }>>(
      `payment_records?status=in.(${PAID_LIKE.map(encodeURIComponent).join(",")})&payment_date=gte.${periodStart}&payment_date=lte.${periodEnd}&select=amount&limit=2000`,
      []
    ),
    safeFetch<Array<{ status: string; updated_at: string }>>(
      `leads?updated_at=gte.${periodStart}&updated_at=lte.${periodEnd}T23:59:59&select=status,updated_at&limit=2000`,
      []
    ),
    safeFetch<Array<{ created_at: string; completed_at: string }>>(
      `agency_tasks?completed_at=gte.${periodStart}&completed_at=lte.${periodEnd}T23:59:59&select=created_at,completed_at&limit=2000`,
      []
    ),
    safeFetch<Array<{ id: string }>>(`companies?status=eq.Aktif&created_at=lte.${periodEnd}T23:59:59&select=id&limit=1000`, []),
    safeFetch<Array<{ score: number }>>(`customer_risk_scores?calculated_at=gte.${periodStart}&calculated_at=lte.${periodEnd}T23:59:59&select=score&limit=2000`, [])
  ]);

  const revenue = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const won = leads.filter((lead) => WON_LIKE.includes(lead.status)).length;
  const lost = leads.filter((lead) => LOST_LIKE.includes(lead.status)).length;
  const closeRate = won + lost > 0 ? won / (won + lost) : null;

  const turnaroundDays = completedTasks
    .map((task) => (new Date(task.completed_at).getTime() - new Date(task.created_at).getTime()) / 86_400_000)
    .filter((days) => Number.isFinite(days) && days >= 0);
  const avgTaskTurnaroundDays = turnaroundDays.length ? turnaroundDays.reduce((sum, days) => sum + days, 0) / turnaroundDays.length : null;

  const avgRiskScore = riskScores.length ? riskScores.reduce((sum, row) => sum + row.score, 0) / riskScores.length : null;

  return {
    revenue: Math.round(revenue),
    closeRate: closeRate !== null ? Math.round(closeRate * 100) : null,
    avgTaskTurnaroundDays: avgTaskTurnaroundDays !== null ? Math.round(avgTaskTurnaroundDays * 10) / 10 : null,
    activeCustomers: activeCompanies.length,
    avgRiskScore: avgRiskScore !== null ? Math.round(avgRiskScore) : null
  };
}

export async function generateBenchmarkSnapshot(periodStart: string, periodEnd: string) {
  const metrics = await computePeriodMetrics(periodStart, periodEnd);

  const periodLengthDays = Math.max(1, Math.round((new Date(periodEnd).getTime() - new Date(periodStart).getTime()) / 86_400_000));
  const priorEnd = new Date(new Date(periodStart).getTime() - 86_400_000).toISOString().slice(0, 10);
  const priorStart = new Date(new Date(priorEnd).getTime() - periodLengthDays * 86_400_000).toISOString().slice(0, 10);
  const priorMetrics = await computePeriodMetrics(priorStart, priorEnd);

  const inserted = await supabaseRest<Array<Record<string, unknown>>>("benchmark_snapshots?on_conflict=period_start,period_end", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      period_start: periodStart,
      period_end: periodEnd,
      metrics: { current: metrics, prior: priorMetrics },
      generated_at: new Date().toISOString()
    })
  });

  return { ok: true, snapshot: inserted[0], internal: { current: metrics, prior: priorMetrics } };
}

export function getExternalBenchmarkStatus() {
  const enabled = String(process.env.EXTERNAL_BENCHMARK_ENABLED || "false").toLowerCase() === "true";
  return {
    available: false, // no opt-in multi-agency data pool exists yet even when the flag is on
    enabled,
    message: enabled
      ? "External benchmark opt-in açık ancak henüz katılımcı ajans verisi/agregasyon havuzu kurulmadı."
      : "External benchmark devre dışı. Yalnızca anonim, opt-in ve agregat veri paylaşılabilir; ham müşteri verisi asla gönderilmez."
  };
}

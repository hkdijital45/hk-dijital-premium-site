import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

// Known scheduled jobs — this repo has no generic job-registry table read by
// any dispatcher (see hk_ai_operations_calendar, which is data-only today),
// so each job's "last run" is read from whatever table that job itself
// writes to, matching the one-independent-route-per-job pattern already used
// throughout this codebase (see src/app/api/admin/*/run-daily routes).
const AUTOMATION_JOBS = [
  { key: "blog-seo-publish-due", label: "Blog & SEO — Zamanlanmış Yayın", schedule: "Her saat", path: "/api/admin/blog-seo/publish-due" },
  { key: "growth-intelligence", label: "HK Growth Intelligence — Günlük Döngü", schedule: "04:00 UTC", path: "/api/admin/growth-intelligence/run-daily" },
  { key: "ceo-briefing", label: "AI CEO Briefing", schedule: "05:00 UTC (08:00 İstanbul)", path: "/api/admin/ceo-briefing/run-daily" },
  { key: "customer-risk", label: "Customer Risk Engine", schedule: "05:00 UTC (08:00 İstanbul)", path: "/api/admin/customer-risk/run-daily" },
  { key: "ad-optimization", label: "Ad Optimizer — Öneri Üretimi", schedule: "05:00 UTC (08:00 İstanbul)", path: "/api/admin/ad-optimization/run-daily" },
  { key: "seo-autopilot", label: "SEO Autopilot — Gerileme Tespiti", schedule: "05:00 UTC (08:00 İstanbul)", path: "/api/admin/seo-autopilot/run-daily" }
];

export async function GET() {
  const session = await requireModuleAccess("operational-quality");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) {
    return NextResponse.json({ qaFindings: [], recentFailures: [], testRuns: [], automation: AUTOMATION_JOBS.map((job) => ({ ...job, lastRunAt: null })), source: "empty" });
  }

  const [qaFindings, recentFailures, testRuns, lastGrowth, lastBriefing, lastRisk, lastAdSuggestion, lastSeoJob] = await Promise.all([
    safeFetch<Array<Record<string, unknown>>>("qa_audit_findings?status=eq.Açık&select=*&order=severity.desc&limit=20", []),
    safeFetch<Array<Record<string, unknown>>>("action_result_logs?status=neq.success&select=*&order=created_at.desc&limit=20", []),
    safeFetch<Array<Record<string, unknown>>>("system_test_runs?select=id,score,status,total_tests,error_count,warning_count,created_at&order=created_at.desc&limit=5", []),
    safeFetch<Array<{ started_at: string }>>("growth_automation_runs?run_type=eq.full_cycle&select=started_at&order=started_at.desc&limit=1", []),
    safeFetch<Array<{ generated_at: string }>>("ceo_briefings?select=generated_at&order=generated_at.desc&limit=1", []),
    safeFetch<Array<{ calculated_at: string }>>("customer_risk_scores?select=calculated_at&order=calculated_at.desc&limit=1", []),
    safeFetch<Array<{ generated_at: string }>>("ad_optimization_suggestions?select=generated_at&order=generated_at.desc&limit=1", []),
    safeFetch<Array<{ triggered_at: string }>>("seo_autopilot_jobs?select=triggered_at&order=triggered_at.desc&limit=1", [])
  ]);

  const lastRunByKey: Record<string, string | null> = {
    "blog-seo-publish-due": null,
    "growth-intelligence": lastGrowth[0]?.started_at || null,
    "ceo-briefing": lastBriefing[0]?.generated_at || null,
    "customer-risk": lastRisk[0]?.calculated_at || null,
    "ad-optimization": lastAdSuggestion[0]?.generated_at || null,
    "seo-autopilot": lastSeoJob[0]?.triggered_at || null
  };

  return NextResponse.json({
    qaFindings,
    recentFailures,
    testRuns,
    automation: AUTOMATION_JOBS.map((job) => ({ ...job, lastRunAt: lastRunByKey[job.key] })),
    source: "database"
  });
}

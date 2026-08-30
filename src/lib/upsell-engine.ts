import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { executeAiTask } from "@/lib/server/ai-router";

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

async function alreadyOpen(companyId: string, triggerType: string) {
  const rows = await safeFetch<Array<{ id: string }>>(
    `upsell_opportunities?company_id=eq.${companyId}&trigger_type=eq.${encodeURIComponent(triggerType)}&status=in.(new,approved)&select=id&limit=1`,
    []
  );
  return rows.length > 0;
}

async function createOpportunity(companyId: string, triggerType: string, recommendedService: string, estimatedValue: number, probability: number, evidence: Record<string, unknown>) {
  const ai = await executeAiTask({
    taskType: "strategy",
    module: "Upsell Engine",
    endpoint: "/api/admin/upsell/run-daily",
    prompt: `Müşteri için upsell fırsatı: ${recommendedService}. Kanıt: ${JSON.stringify(evidence)}. Bu fırsat için 2 cümlelik satış açıklaması yaz (abartısız, kanıta dayalı).`,
    expectedOutput: "2 cümlelik satış açıklaması",
    fallbackText: `${recommendedService} için güçlü performans sinyalleri var; genişletme fırsatı değerlendirilebilir.`,
    createdBy: null
  }, { cacheTtlMs: 10 * 60_000 });

  await supabaseRest("upsell_opportunities", {
    method: "POST",
    body: JSON.stringify({
      company_id: companyId,
      trigger_type: triggerType,
      recommended_service: recommendedService,
      estimated_value: estimatedValue,
      probability,
      evidence,
      ai_pitch: ai.text,
      status: "new"
    })
  });
}

export async function detectUpsellOpportunities(triggeredBy: "cron" | "manual" = "manual") {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();

  const [companies, adInterpretations, branches] = await Promise.all([
    safeFetch<Array<{ id: string; customer_package_type: string | null }>>("companies?status=eq.Aktif&select=id,customer_package_type&limit=500", []),
    safeFetch<Array<{ customer_id: string; platform: string; health_score: number; created_at: string }>>(
      `ad_ai_interpretations?created_at=gte.${sixtyDaysAgo}&select=customer_id,platform,health_score,created_at&order=created_at.desc&limit=1000`,
      []
    ),
    safeFetch<Array<{ company_id: string }>>("customer_branches?is_active=eq.true&select=company_id&limit=2000", [])
  ]);

  const branchCountByCompany = new Map<string, number>();
  for (const row of branches) branchCountByCompany.set(row.company_id, (branchCountByCompany.get(row.company_id) || 0) + 1);

  const latestHealthByCompanyPlatform = new Map<string, number>();
  for (const row of adInterpretations) {
    const key = `${row.customer_id}::${row.platform}`;
    if (!latestHealthByCompanyPlatform.has(key)) latestHealthByCompanyPlatform.set(key, row.health_score);
  }

  let created = 0;
  for (const company of companies) {
    const metaHealth = latestHealthByCompanyPlatform.get(`${company.id}::meta`);
    const googleHealth = latestHealthByCompanyPlatform.get(`${company.id}::google`);
    const packageType = String(company.customer_package_type || "").toLowerCase();
    const branchCount = branchCountByCompany.get(company.id) || 0;

    if (metaHealth && metaHealth > 80 && !packageType.includes("google") && !packageType.includes("combined")) {
      if (!(await alreadyOpen(company.id, "meta_strong_no_google"))) {
        await createOpportunity(company.id, "meta_strong_no_google", "Google Ads Yönetimi (cross-sell)", 8000, 55, { metaHealthScore: metaHealth });
        created += 1;
      }
    }

    if (googleHealth && googleHealth > 80 && !packageType.includes("meta") && !packageType.includes("combined")) {
      if (!(await alreadyOpen(company.id, "google_strong_no_meta"))) {
        await createOpportunity(company.id, "google_strong_no_meta", "Meta Reklam Yönetimi (cross-sell)", 8000, 55, { googleHealthScore: googleHealth });
        created += 1;
      }
    }

    if (branchCount > 1 && !packageType.includes("premium")) {
      if (!(await alreadyOpen(company.id, "multi_branch_upgrade"))) {
        await createOpportunity(company.id, "multi_branch_upgrade", "Çoklu Şube Paket Yükseltmesi", 6000, 40, { activeBranches: branchCount });
        created += 1;
      }
    }
  }

  return { ok: true, triggeredBy, companiesScanned: companies.length, opportunitiesCreated: created };
}

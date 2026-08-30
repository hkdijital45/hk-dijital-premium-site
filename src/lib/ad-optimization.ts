import "server-only";
import { supabaseRest } from "@/lib/supabase";

type Diagnosis = {
  name?: string;
  level?: string;
  symptom?: string;
  likelyCause?: string;
  businessImpact?: string;
  recommendation?: string;
  priorityScore?: number;
};

function riskLevelForDiagnosisLevel(level: string | undefined): "low" | "medium" | "high" {
  if (level === "Kritik") return "high";
  if (level === "Uyarı") return "medium";
  return "low";
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

// Reuses "Reklam Doktoru Pro"'s already-AI-generated diagnoses/recommendations
// (ad_ai_interpretations.insights.diagnoses) rather than re-deriving issues
// from raw metrics — this module's job is only the missing piece: turning an
// existing diagnosis into a trackable, approvable suggestion.
export async function generateAdOptimizationSuggestions(triggeredBy: "cron" | "manual" = "manual") {
  const today = new Date().toISOString().slice(0, 10);

  const interpretations = await safeFetch<Array<{
    id: string;
    customer_id: string;
    platform: string;
    insights: { diagnoses?: Diagnosis[] };
    health_score: number;
    created_at: string;
  }>>(`ad_ai_interpretations?select=id,customer_id,platform,insights,health_score,created_at&order=created_at.desc&limit=200`, []);

  const seenCompanies = new Set<string>();
  const latestPerCompany = interpretations.filter((row) => {
    if (seenCompanies.has(row.customer_id)) return false;
    seenCompanies.add(row.customer_id);
    return true;
  });

  let created = 0;
  for (const interpretation of latestPerCompany) {
    const diagnoses = (interpretation.insights?.diagnoses || []).filter((diagnosis) => diagnosis.name && diagnosis.name !== "Veri eksik");
    for (const diagnosis of diagnoses.slice(0, 5)) {
      const idempotencyKey = `${interpretation.customer_id}-${diagnosis.name}-${today}`;
      try {
        await supabaseRest("ad_optimization_suggestions", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
          body: JSON.stringify({
            company_id: interpretation.customer_id,
            platform: interpretation.platform === "meta" || interpretation.platform === "google" ? interpretation.platform : "all",
            issue_type: diagnosis.name,
            current_value: diagnosis.symptom || null,
            target_value: null,
            suggested_action: diagnosis.recommendation || "İnceleme gerekiyor.",
            action_payload: { likelyCause: diagnosis.likelyCause || null, businessImpact: diagnosis.businessImpact || null },
            ai_reasoning: [diagnosis.likelyCause, diagnosis.businessImpact].filter(Boolean).join(" "),
            confidence: Math.min(100, Math.max(0, Math.round(diagnosis.priorityScore || 60))),
            risk_level: riskLevelForDiagnosisLevel(diagnosis.level),
            status: "pending",
            idempotency_key: idempotencyKey
          })
        });
        created += 1;
      } catch {
        // Duplicate for today (same company+issue) or transient error — skip, not fatal to the batch.
      }
    }
  }

  return { ok: true, triggeredBy, companiesScanned: latestPerCompany.length, suggestionsCreated: created };
}

// Section 9/29 safety rule: AUTO_APPLY_AD_CHANGES defaults to false, and no
// write-capable Meta/Google Ads mutation client exists in this codebase yet
// (both are read/reporting-only per the current integration files) — so an
// "apply" can never silently claim success. It only ever moves a suggestion
// to "approved" (human decision recorded) and reports the real capability gap.
export async function applyAdOptimizationSuggestion(id: string) {
  const rows = await supabaseRest<Array<{ id: string; status: string }>>(`ad_optimization_suggestions?id=eq.${encodeURIComponent(id)}&select=id,status&limit=1`);
  const suggestion = rows[0];
  if (!suggestion) return { ok: false, error: "Öneri bulunamadı." };
  if (suggestion.status !== "approved") return { ok: false, error: "Yalnızca onaylanmış öneriler uygulanabilir." };

  const autoApplyEnabled = String(process.env.AUTO_APPLY_AD_CHANGES || "false").toLowerCase() === "true";
  if (!autoApplyEnabled) {
    return {
      ok: false,
      status: "approved",
      message: "AUTO_APPLY_AD_CHANGES kapalı — bu ortamda dış reklam hesabına otomatik mutasyon uygulanmaz. Öneri onaylandı olarak işaretlendi; uygulama manuel yapılmalıdır."
    };
  }

  // Even if the flag is enabled, no real Meta/Google Ads write client exists
  // in this codebase yet — return the capability gap explicitly rather than
  // fabricating a provider_response.
  return {
    ok: false,
    status: "approved",
    message: "Dış reklam platformuna yazma entegrasyonu bu ortamda henüz yapılandırılmadı; mutasyon uygulanmadı."
  };
}

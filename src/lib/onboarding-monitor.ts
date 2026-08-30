import "server-only";
import { supabaseRest } from "@/lib/supabase";
import { buildCustomerSetupSummary, getCustomerSetupSteps } from "@/lib/customer-onboarding";

const REMINDER_COOLDOWN_DAYS = 3;

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await supabaseRest<T>(path);
  } catch {
    return fallback;
  }
}

// Mirrors loadContext() in src/app/api/admin/customers/[id]/integrations/route.ts
// (not exported there) — same tables, same shape, just looped across every
// active company instead of one. getCustomerSetupSteps/buildCustomerSetupSummary
// themselves are reused as-is, not reimplemented.
async function loadCompanyContext(companyId: string) {
  const [userRows, integrationRows, campaigns, reports, branches, tasks] = await Promise.all([
    safeFetch<Array<Record<string, unknown>>>(`users?company_id=eq.${companyId}&select=id,is_active,role`, []),
    safeFetch<Array<Record<string, unknown>>>(`customer_integrations?company_id=eq.${companyId}&select=*&limit=1`, []),
    safeFetch<Array<{ id: string }>>(`campaigns?company_id=eq.${companyId}&select=id&limit=1`, []),
    safeFetch<Array<{ id: string }>>(`reports?company_id=eq.${companyId}&select=id&limit=1`, []),
    safeFetch<Array<Record<string, unknown>>>(`customer_branches?company_id=eq.${companyId}&select=id,company_id,is_active,status`, []),
    safeFetch<Array<{ id: string; company_id: string }>>(`agency_tasks?company_id=eq.${companyId}&select=id,company_id&limit=1`, [])
  ]);
  return { users: userRows, integration: integrationRows[0] || {}, campaigns, reports, branches, tasks };
}

export async function runOnboardingMonitor(triggeredBy: "cron" | "manual" = "manual") {
  const companies = await safeFetch<Array<Record<string, unknown>>>("companies?status=eq.Aktif&select=*&limit=300", []);
  let stalled = 0;
  let reminded = 0;

  for (const company of companies) {
    const companyId = String(company.id);
    const context = await loadCompanyContext(companyId);
    const steps = getCustomerSetupSteps(company, context.users, context.integration, context.campaigns, context.reports, context);
    const summary = buildCustomerSetupSummary(steps);
    if (summary.progress >= 100 || !summary.missing.length) continue;

    stalled += 1;
    const nextStep = summary.missing[0];
    const cooldownKey = `${companyId}::${nextStep.key}`;

    const existingLog = await safeFetch<Array<{ cooldown_until: string }>>(
      `onboarding_reminder_log?company_id=eq.${companyId}&step_key=eq.${encodeURIComponent(nextStep.key)}&select=cooldown_until&limit=1`,
      []
    );
    const stillCoolingDown = existingLog[0] && new Date(existingLog[0].cooldown_until).getTime() > Date.now();
    if (stillCoolingDown) continue;

    const cooldownUntil = new Date(Date.now() + REMINDER_COOLDOWN_DAYS * 86_400_000).toISOString();
    await supabaseRest("onboarding_reminder_log?on_conflict=company_id,step_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ company_id: companyId, step_key: nextStep.key, reminded_at: new Date().toISOString(), cooldown_until: cooldownUntil })
    }).catch(() => null);

    await supabaseRest("agency_tasks", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        title: `Onboarding takıldı: ${nextStep.title}`,
        description: `${company.name || "Müşteri"} için kurulum ${summary.progress}% seviyesinde. Bekleyen adım: ${nextStep.description}`,
        status: "Yapılacak",
        priority: "Normal",
        due_date: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
        automation_key: `onboarding-${cooldownKey}-${Date.now()}`
      })
    }).catch(() => null);
    reminded += 1;
  }

  return { ok: true, triggeredBy, companiesChecked: companies.length, stalled, remindersCreated: reminded };
}

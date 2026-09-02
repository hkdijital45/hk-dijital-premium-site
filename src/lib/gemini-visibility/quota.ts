import { supabaseRest } from "@/lib/supabase";
import { DEFAULT_MONTHLY_QUOTA_GLOBAL, DEFAULT_MONTHLY_QUOTA_PER_CUSTOMER } from "./types";
import { buildQuotaStatus } from "./quota-math";
import type { QuotaStatus } from "./quota-math";

export type { QuotaStatus } from "./quota-math";
export { allowedQuestionCount } from "./quota-math";

function currentMonthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// Quota is measured in actual live Gemini requests made this calendar month
// (cached=eq.false) — a scan that fully hits the 7-day cache costs nothing
// against the budget, matching real API spend rather than planned question
// counts.
async function monthlyBilledAnswers(companyFilter?: string): Promise<number> {
  const parts = [
    companyFilter,
    "cached=eq.false",
    `created_at=gte.${encodeURIComponent(currentMonthStartIso())}`,
    "select=id"
  ].filter(Boolean);
  const rows = await supabaseRest<Array<{ id: string }>>(`gemini_visibility_answers?${parts.join("&")}`);
  return rows.length;
}

export async function getQuotaStatus(companyId: string): Promise<QuotaStatus> {
  const [customerUsed, globalUsed] = await Promise.all([
    monthlyBilledAnswers(`company_id=eq.${encodeURIComponent(companyId)}`),
    monthlyBilledAnswers()
  ]);
  return buildQuotaStatus(customerUsed, DEFAULT_MONTHLY_QUOTA_PER_CUSTOMER, globalUsed, DEFAULT_MONTHLY_QUOTA_GLOBAL);
}

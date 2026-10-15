import "server-only";

import { supabaseRest } from "@/lib/supabase";

// Which business a report is ABOUT, from its stored association only:
//   business_unit_id (şube / bağlı marka) → company → lead → stored title.
// Never inferred from free text or similar names; a legacy report without
// a business_unit_id keeps its verified owner's name (nothing is guessed
// and no ownership is rewritten).
export async function resolveReportDisplayName(scope: { businessUnitId?: string | null; companyId?: string | null; leadId?: string | null }, fallbackTitle: string): Promise<string> {
  const one = async <T,>(path: string) => (await supabaseRest<T[]>(path).catch(() => []))[0];
  if (scope.businessUnitId) {
    const unit = await one<{ name: string | null }>(`business_units?id=eq.${encodeURIComponent(scope.businessUnitId)}&select=name&limit=1`);
    if (unit?.name) return unit.name;
  }
  if (scope.companyId) {
    const company = await one<{ name: string | null }>(`companies?id=eq.${encodeURIComponent(scope.companyId)}&select=name&limit=1`);
    if (company?.name) return company.name;
  }
  if (scope.leadId) {
    const lead = await one<{ company: string | null; name: string | null }>(`leads?id=eq.${encodeURIComponent(scope.leadId)}&select=company,name&limit=1`);
    if (lead?.company || lead?.name) return (lead.company || lead.name) as string;
  }
  return fallbackTitle || "Firma";
}

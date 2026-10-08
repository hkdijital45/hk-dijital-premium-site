import { NextResponse } from "next/server";
import { requireMobileStaffSession } from "@/lib/mobile-auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

/**
 * Real Meta/Google Ads CONNECTION status per customer, in one batched
 * request (no N+1) — never a live Meta Graph API call from this route,
 * and no Meta/Google access token is ever included in the response. This
 * mirrors (a simplified subset of) the same meta_ad_account_id/
 * google_ads_customer_id check getCustomerIntegrations() does per-company
 * for the web admin; batched here since a list screen can't afford one
 * request per customer. Live campaign performance (spend/CTR/CPC/...)
 * is intentionally NOT included — reaching that honestly requires the
 * existing Reklam Doktoru Pro sync pipeline, not reproduced here; the
 * mobile Advertising screen shows connection status only and is explicit
 * about that scope.
 */
export async function GET(request: Request) {
  const session = requireMobileStaffSession(request);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  try {
    const [companies, integrations] = await Promise.all([
      supabaseRest<Array<{ id: string; name: string; sector: string | null }>>("companies?select=id,name,sector&deleted_at=is.null&order=name.asc&limit=200"),
      supabaseRest<Array<{ company_id: string; meta_ad_account_id: string | null; google_ads_customer_id: string | null }>>(
        "customer_integrations?select=company_id,meta_ad_account_id,google_ads_customer_id&limit=1000"
      ).catch(() => [])
    ]);

    const byCompany = new Map(integrations.map((row) => [row.company_id, row]));
    const items = companies.map((company) => {
      const row = byCompany.get(company.id);
      return {
        id: company.id,
        name: company.name,
        sector: company.sector,
        metaConnected: Boolean(row?.meta_ad_account_id),
        googleConnected: Boolean(row?.google_ads_customer_id)
      };
    });

    return NextResponse.json({ customers: items });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

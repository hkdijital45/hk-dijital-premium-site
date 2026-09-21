import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

// Per-customer connection status for Organik Büyüme Merkezi's müşteri
// seçimi (Search Console / AI Visibility tabs). Reads the existing
// canonical customer_integrations table (already the single source of
// truth for a company's Google connections — see website-analytics.ts /
// customer-integration-oauth.ts) — no new table, no new OAuth flow.
type IntegrationRow = { search_console_site_url: string | null; ga4_measurement_id: string | null; ga4_property_id: string | null };

export async function GET(request: Request) {
  const session = await requireModuleAccess("blog-seo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const companyId = new URL(request.url).searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId zorunludur." }, { status: 400 });

  try {
    const rows = await supabaseRest<IntegrationRow[]>(
      `customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=search_console_site_url,ga4_measurement_id,ga4_property_id&limit=1`
    );
    const row = rows[0] || null;
    return NextResponse.json({
      searchConsoleConnected: Boolean(row?.search_console_site_url),
      searchConsoleSiteUrl: row?.search_console_site_url || null,
      ga4Connected: Boolean(row?.ga4_measurement_id || row?.ga4_property_id)
    });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

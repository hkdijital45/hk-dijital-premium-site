import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { supabaseRest, getSafeSupabaseError } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getAllProviderConnectionStatuses } from "@/lib/analytics-center/connections";
import { getMetaAdsAccount } from "@/lib/marketing-intelligence/ad-accounts";

// HK Connect — Entegrasyon Merkezi status reader. Reuses the exact same
// real connection sources already used elsewhere (Analiz & Raporlama
// Merkezi's connection reader, the Marketing Intelligence MCP's Meta Ads
// mapping check) — no fabricated "connected" state, no new integration
// table.
export async function GET(request: Request) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const [connections, metaAds, rows] = await Promise.all([
      getAllProviderConnectionStatuses(companyId),
      getMetaAdsAccount(companyId),
      supabaseRest<Array<{ ga4_property_id: string | null; search_console_site_url: string | null; gtm_container_id: string | null }>>(
        `customer_integrations?company_id=eq.${encodeURIComponent(companyId)}&select=ga4_property_id,search_console_site_url,gtm_container_id&limit=1`
      )
    ]);
    const byProvider = new Map(connections.map((c) => [c.provider, c]));
    const row = rows[0] || null;

    return NextResponse.json({
      platforms: {
        instagram: byProvider.get("instagram")?.status || "not_connected",
        facebook: byProvider.get("facebook")?.status || "not_connected",
        tiktok: byProvider.get("tiktok")?.status || "not_connected",
        youtube: byProvider.get("youtube")?.status || "not_connected",
        google_ads: byProvider.get("google_ads")?.status || "not_connected",
        meta_ads: metaAds.status,
        ga4: row?.ga4_property_id ? "connected" : "not_connected",
        search_console: row?.search_console_site_url ? "connected" : "not_connected",
        gtm: row?.gtm_container_id ? "connected" : "not_connected"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

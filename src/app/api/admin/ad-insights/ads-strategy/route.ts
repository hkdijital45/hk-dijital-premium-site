import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getLatestAdsStrategy } from "@/lib/marketing-intelligence/ads-strategy";

// Read-only: HK Admin only displays the strategy Claude already saved via
// MCP (save_ads_strategy_plan) — this route never calls Claude/Anthropic.
export async function GET(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const run = await getLatestAdsStrategy(companyId);
  return NextResponse.json({ run });
}

import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getAdStrategyHistory, getAdStrategyForActivation, getLegacyAdsStrategyRun } from "@/lib/marketing-intelligence/ad-strategies";

// Read-only: HK Admin's Reklam Stratejisi tab. Reuses ad_strategies (the
// real, versioned, status-tracked table Claude's save_ads_strategy_plan
// MCP tool writes to) as source of truth. `current` prefers active >
// approved > the newest version on file, so the UI can highlight what's
// actually implementable; `history` is every version for the Geçmiş tab;
// `legacy` is a real, pre-existing hk_intelligence_ceo_runs record shown
// only when this company has no row yet in the new table.
export async function GET(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const history = await getAdStrategyHistory(companyId);
    if (history.length) {
      const activation = await getAdStrategyForActivation(companyId);
      return NextResponse.json({ current: activation.strategy || history[0], history, legacy: null });
    }
    const legacy = await getLegacyAdsStrategyRun(companyId);
    return NextResponse.json({ current: null, history: [], legacy });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

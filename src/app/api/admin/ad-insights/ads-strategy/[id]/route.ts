import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { updateAdStrategy, AdStrategyNotFoundError, type AdStrategyUpdateInput } from "@/lib/marketing-intelligence/ad-strategies";

const EDITABLE_KEYS: Array<keyof AdStrategyUpdateInput> = [
  "strategy_title", "primary_platform", "primary_goal", "monthly_ad_budget", "daily_budget_estimate",
  "meta_budget", "google_budget", "primary_kpi", "campaign_sequence", "remarketing", "internal_report", "client_report"
];

// Edits a single ad_strategies row. company_id is taken from the request
// body and re-verified server-side (updateAdStrategy requires an id+
// company_id match at the query level) — a client cannot edit another
// company's strategy just by supplying a different id.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz strateji kimliği." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  const patch: AdStrategyUpdateInput = {};
  for (const key of EDITABLE_KEYS) if (key in body) (patch as Record<string, unknown>)[key] = body[key];
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });

  try {
    const strategy = await updateAdStrategy(companyId, id, patch);
    return NextResponse.json({ strategy });
  } catch (error) {
    if (error instanceof AdStrategyNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

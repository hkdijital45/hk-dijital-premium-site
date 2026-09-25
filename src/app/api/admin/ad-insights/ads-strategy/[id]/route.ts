import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { updateAdStrategy, validateAdStrategyPatch, AdStrategyNotFoundError, AdStrategyPatchValidationError } from "@/lib/marketing-intelligence/ad-strategies";

// Edits a single ad_strategies row. company_id is taken from the request
// body and re-verified server-side (updateAdStrategy requires an id+
// company_id match at the query level) — a client cannot edit another
// company's strategy just by supplying a different id. Allowlist +
// per-field type validation both live in validateAdStrategyPatch
// (ad-strategies.ts) — the same function the update_ads_strategy_content
// MCP tool uses, so HK Admin and Claude edit through one canonical rule,
// never two that could drift.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz strateji kimliği." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const { companyId: _omit, ...rest } = body;
    const patch = validateAdStrategyPatch(rest);
    const strategy = await updateAdStrategy(companyId, id, patch);
    return NextResponse.json({ strategy });
  } catch (error) {
    if (error instanceof AdStrategyPatchValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof AdStrategyNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

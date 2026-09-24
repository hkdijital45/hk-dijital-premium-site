import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { updateAdStrategyStatus, AD_STRATEGY_STATUSES, AdStrategyNotFoundError, AdsStrategyValidationError, type AdStrategyStatus } from "@/lib/marketing-intelligence/ad-strategies";

// Status transitions only (draft/approved/active/updated/archived) —
// HK Dijital's own internal operational state, never touches any real
// Meta/Google ad account or campaign.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz strateji kimliği." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  const status = String(body.status || "") as AdStrategyStatus;
  if (!AD_STRATEGY_STATUSES.includes(status)) return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });

  try {
    const strategy = await updateAdStrategyStatus(companyId, id, status);
    return NextResponse.json({ strategy });
  } catch (error) {
    if (error instanceof AdStrategyNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    if (error instanceof AdsStrategyValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

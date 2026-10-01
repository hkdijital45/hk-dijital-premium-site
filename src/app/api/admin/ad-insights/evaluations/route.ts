import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getAdEvaluationHistory, createAdEvaluationDraft, AdEvaluationValidationError, AdEvaluationCompanyNotFoundError } from "@/lib/marketing-intelligence/ad-evaluations";

// GET: full evaluation history for a company (optionally scoped to one
// campaign). POST: persists a new DRAFT snapshot (metrics + generated
// prompt) — the "reproducible snapshot" step; the report content itself
// is filled in later via [id]/import once the Claude output is pasted
// back in.
export async function GET(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId") || "";
  const campaignId = searchParams.get("campaignId") || undefined;
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const history = await getAdEvaluationHistory(companyId, campaignId);
    return NextResponse.json({ current: history[0] || null, history });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  try {
    const evaluation = await createAdEvaluationDraft(body);
    return NextResponse.json({ evaluation });
  } catch (error) {
    if (error instanceof AdEvaluationValidationError || error instanceof AdEvaluationCompanyNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof AdEvaluationCompanyNotFoundError ? 404 : 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getCreativeReportHistory, saveCreativeReportDraft, AdCreativeReportValidationError, AdCreativeReportCompanyNotFoundError } from "@/lib/marketing-intelligence/ad-creative-reports";

// GET: current (latest version) + full history for a company. POST:
// creates a new DRAFT — used by "Kreatif Raporu Oluştur" on the Reklam
// Stratejisi screen (optionally linked via adStrategyId/adStrategyVersion)
// or a bare "yeni rapor" start with no strategy link.
export async function GET(request: Request) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const history = await getCreativeReportHistory(companyId);
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
    const report = await saveCreativeReportDraft(body);
    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof AdCreativeReportValidationError || error instanceof AdCreativeReportCompanyNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: error instanceof AdCreativeReportCompanyNotFoundError ? 404 : 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

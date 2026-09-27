import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { updateCreativeReport, validateCreativeReportPatch, AdCreativeReportNotFoundError, AdCreativeReportPatchValidationError } from "@/lib/marketing-intelligence/ad-creative-reports";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("ad-insights");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const { id } = await params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Geçersiz rapor kimliği." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const { companyId: _omit, ...rest } = body;
    const patch = validateCreativeReportPatch(rest);
    const report = await updateCreativeReport(companyId, id, patch);
    return NextResponse.json({ report });
  } catch (error) {
    if (error instanceof AdCreativeReportPatchValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof AdCreativeReportNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";
import { getReportCenterItems } from "@/lib/report-center";

// Company scope is enforced here (required, validated companyId) — every
// adapter inside getReportCenterItems is itself company-scoped, so there
// is no step in this request that reads another company's rows.
export async function GET(request: Request) {
  const session = await requireModuleAccess("rapor-merkezi");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const companyId = new URL(request.url).searchParams.get("companyId") || "";
  if (!companyId || !uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });

  try {
    const result = await getReportCenterItems(companyId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Rapor merkezi verisi alınamadı." }, { status: 500 });
  }
}

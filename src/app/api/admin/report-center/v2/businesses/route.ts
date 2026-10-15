import { NextResponse } from "next/server";
import { canListOwners, reportCenterErrorResponse, requireReportCenterSession, unauthorized } from "@/lib/report-center-v2/access";
import { listOwnerBusinesses } from "@/lib/report-center-v2/server";

// "İşletme / Şube Seç" — only businesses linked to the selected owner
// through real business_relationships rows (never inferred from names).
export async function GET(request: Request) {
  const session = await requireReportCenterSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const ownerType = params.get("ownerType");
  if (ownerType !== "lead" && ownerType !== "company") return NextResponse.json({ error: "Geçersiz kayıt türü." }, { status: 400 });
  if (!canListOwners(session, ownerType)) return unauthorized();
  try {
    const businesses = await listOwnerBusinesses({ type: ownerType, id: params.get("ownerId") || "" });
    return NextResponse.json({ businesses }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return reportCenterErrorResponse(error, "İşletmeler yüklenemedi.");
  }
}

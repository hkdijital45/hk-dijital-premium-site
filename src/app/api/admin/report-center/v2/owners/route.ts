import { NextResponse } from "next/server";
import { canListOwners, reportCenterErrorResponse, requireReportCenterSession, unauthorized } from "@/lib/report-center-v2/access";
import { listOwners } from "@/lib/report-center-v2/server";

// "Lead Seç" / "Müşteri Seç" — two separate, searchable lists. Never
// merged, never converted: a lead stays a lead here.
export async function GET(request: Request) {
  const session = await requireReportCenterSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  if (type !== "lead" && type !== "company") return NextResponse.json({ error: "Geçersiz kayıt türü." }, { status: 400 });
  if (!canListOwners(session, type)) return unauthorized();
  try {
    const owners = await listOwners(type, params.get("q"));
    return NextResponse.json({ owners }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return reportCenterErrorResponse(error, "Kayıtlar yüklenemedi.");
  }
}

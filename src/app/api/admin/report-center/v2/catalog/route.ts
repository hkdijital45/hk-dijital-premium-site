import { NextResponse } from "next/server";
import { REPORT_CATEGORIES } from "@/lib/report-center-v2/catalog";
import { accessibleReportTypes, requireReportCenterSession } from "@/lib/report-center-v2/access";

// Rapor Merkezi V2 — categories and report types this user may open
// (types whose source module the user can't access are not offered).
export async function GET() {
  const session = await requireReportCenterSession();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const types = accessibleReportTypes(session);
  const categories = REPORT_CATEGORIES.filter((c) => types.some((t) => t.category === c.key));
  return NextResponse.json({ categories, types }, { headers: { "Cache-Control": "no-store" } });
}

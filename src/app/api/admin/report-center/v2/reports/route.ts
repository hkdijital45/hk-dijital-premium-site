import { NextResponse } from "next/server";
import { reportCenterErrorResponse, requireReportTypeAccess, unauthorized } from "@/lib/report-center-v2/access";
import { listReports } from "@/lib/report-center-v2/server";
import { ownerFromParams } from "@/lib/report-center-v2/params";

const PAGE_SIZE = 20;

// Paginated, newest-first list of one report type for one selected lead /
// customer (and business). Owner scoping is part of the database query.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const access = await requireReportTypeAccess(params.get("type"));
  if (!access) return unauthorized();
  const offset = Math.max(0, Math.min(10_000, Number(params.get("offset")) || 0));
  try {
    const result = await listReports(access.def.key, {
      owner: ownerFromParams(params),
      business: params.get("business") || "main",
      from: params.get("from"),
      to: params.get("to"),
      q: params.get("q"),
      includeArchived: params.get("archived") === "1",
      limit: PAGE_SIZE,
      offset
    });
    return NextResponse.json({ ...result, offset, pageSize: PAGE_SIZE }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return reportCenterErrorResponse(error, "Raporlar yüklenemedi.");
  }
}

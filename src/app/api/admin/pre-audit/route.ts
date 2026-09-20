import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { listPreAuditReports, getPreAuditSummary, listPreReviewQueue } from "@/lib/pre-audit/reports";
import { LEAD_PRE_REVIEW_STATUS } from "@/lib/pre-audit/types";

// Ön İnceleme Merkezi — report management/viewing only. Completed analysis
// reports are created exclusively via the save_pre_audit_report MCP tool
// (see src/lib/instagram-intelligence/mcp/protocol.ts); this route never
// writes those. Queue actions (start/reject/promote) live in
// pre-audit/lead/[id]/route.ts.
export async function GET(request: Request) {
  const session = await requireModuleAccess("on-inceleme");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") || undefined;
  const search = url.searchParams.get("q") || undefined;

  try {
    const [reports, summary, pending, inReview, rejected] = await Promise.all([
      listPreAuditReports(companyId, search),
      getPreAuditSummary(),
      listPreReviewQueue(LEAD_PRE_REVIEW_STATUS.PENDING),
      listPreReviewQueue(LEAD_PRE_REVIEW_STATUS.IN_REVIEW),
      listPreReviewQueue(LEAD_PRE_REVIEW_STATUS.REJECTED)
    ]);
    return NextResponse.json({ reports, summary, queue: { pending, inReview, rejected } });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    // The migration may not be applied yet — don't 500 the whole center.
    if (/relation .* does not exist|schema cache/i.test(safe.detail)) {
      return NextResponse.json({ tablesReady: false, reports: [], summary: { totalPreAudits: 0, thisMonth: 0, potentialCompanies: 0, convertedCompanies: 0 }, queue: { pending: [], inReview: [], rejected: [] } });
    }
    return NextResponse.json({ error: safe.detail }, { status: 500 });
  }
}

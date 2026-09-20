import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { listPreAuditReports, getPreAuditSummary } from "@/lib/pre-audit/reports";

// Ön İnceleme Merkezi — report management/viewing only. Reports themselves
// are created exclusively via the save_pre_audit_report MCP tool (see
// src/lib/instagram-intelligence/mcp/protocol.ts); this route never writes.
export async function GET(request: Request) {
  const session = await requireModuleAccess("on-inceleme");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") || undefined;
  const search = url.searchParams.get("q") || undefined;

  try {
    const [reports, summary] = await Promise.all([listPreAuditReports(companyId, search), getPreAuditSummary()]);
    return NextResponse.json({ reports, summary });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    // The migration may not be applied yet — don't 500 the whole center.
    if (/relation .* does not exist|schema cache/i.test(safe.detail)) {
      return NextResponse.json({ tablesReady: false, reports: [], summary: { totalPreAudits: 0, thisMonth: 0, potentialCompanies: 0, convertedCompanies: 0 } });
    }
    return NextResponse.json({ error: safe.detail }, { status: 500 });
  }
}

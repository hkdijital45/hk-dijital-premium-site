import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { listCandidateEvaluations } from "@/lib/candidate-evaluation/reports";

// Aday Değerlendirme Raporları — report listing/viewing only. Reports are
// created exclusively via the save_candidate_evaluation MCP tool (see
// src/lib/instagram-intelligence/mcp/protocol.ts), mirroring Ön İnceleme's
// architecture exactly. Never scoped to a customer selector — a prospect
// does not need to be a customer to have evaluation reports.
export async function GET(request: Request) {
  const session = await requireModuleAccess("on-inceleme");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId") || undefined;
  const leadId = url.searchParams.get("leadId") || undefined;
  const search = url.searchParams.get("q") || undefined;

  try {
    const reports = await listCandidateEvaluations(companyId, leadId, search, 200);
    return NextResponse.json({ reports });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    if (/relation .* does not exist|schema cache/i.test(safe.detail)) {
      return NextResponse.json({ tablesReady: false, reports: [] });
    }
    return NextResponse.json({ error: safe.detail }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { getCandidateEvaluationCompanyContext, getCandidateEvaluationLeadContext } from "@/lib/candidate-evaluation/reports";

// Thin HTTP wrapper around the existing context-resolution service (the
// same functions the MCP tools use) — gives the admin UI (Rapor Merkezi /
// Reklam Doktoru Pro's "Aday Değerlendirmeleri") a real business-name/
// sector/source lookup for the "İşletme / Aday Seç" selector without any
// new business logic or duplicated resolution rules.
export async function GET(request: Request) {
  const session = await requireModuleAccess("on-inceleme");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const url = new URL(request.url);
  const leadId = url.searchParams.get("leadId") || undefined;
  const companyId = url.searchParams.get("companyId") || undefined;
  if (!leadId && !companyId) return NextResponse.json({ error: "leadId veya companyId zorunludur." }, { status: 400 });

  try {
    const context = leadId ? await getCandidateEvaluationLeadContext(leadId) : await getCandidateEvaluationCompanyContext(companyId);
    return NextResponse.json(context);
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

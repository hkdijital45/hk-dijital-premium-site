import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { getCandidateEvaluationCompanyContext, getCandidateEvaluationLeadContext, scopeCandidateContextToBusiness, CandidateEvaluationBusinessUnitError } from "@/lib/candidate-evaluation/reports";
import { uuidPattern } from "@/lib/meta-pixel-admin";

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
  const businessUnitId = url.searchParams.get("businessUnitId") || undefined;
  if (businessUnitId && !uuidPattern.test(businessUnitId)) return NextResponse.json({ error: "Geçersiz işletme kimliği." }, { status: 400 });

  try {
    const context = leadId ? await getCandidateEvaluationLeadContext(leadId) : await getCandidateEvaluationCompanyContext(companyId);
    return NextResponse.json(await scopeCandidateContextToBusiness(context, businessUnitId));
  } catch (error) {
    if (error instanceof CandidateEvaluationBusinessUnitError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

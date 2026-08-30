import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await requireModuleAccess("customer-risk");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ scores: [], source: "empty" });

  try {
    const rows = await supabaseRest<Array<Record<string, unknown>>>(
      "customer_risk_scores?select=*,companies(name)&order=calculated_at.desc&limit=500"
    );
    const seen = new Set<string>();
    const latestPerCompany = rows.filter((row) => {
      const companyId = String(row.company_id);
      if (seen.has(companyId)) return false;
      seen.add(companyId);
      return true;
    });
    return NextResponse.json({ scores: latestPerCompany, source: "database" });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

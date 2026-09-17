import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { getAllIntelligence } from "@/lib/marketing-intelligence/intelligence-store";

// Claude Çalışmaları — reads the same hk_intelligence_ceo_runs rows
// save_marketing_intelligence (the Marketing Intelligence MCP tool)
// writes. No separate activity table.
export async function GET(request: Request) {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const companyId = new URL(request.url).searchParams.get("companyId") || undefined;
  try {
    return NextResponse.json({ runs: await getAllIntelligence(companyId, 100) });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

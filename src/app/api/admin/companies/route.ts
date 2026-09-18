import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canAccessModule } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { resolveHkDijitalCompanyId } from "@/lib/content-plan/hk-dijital-company";

// A minimal id/name company picker list, reused by any admin screen that
// needs a customer dropdown (e.g. Gemini Görünürlük Merkezi, İçerik Takip)
// without pulling the full customer record set that
// /api/admin/customers/export or the CRM dashboard load.
export async function GET() {
  const session = await getSession();
  const allowed = session && (canAccessModule(session, "growth-intelligence") || canAccessModule(session, "social-autopilot"));
  if (!allowed) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ companies: [] });

  try {
    const companies = await supabaseRest<Array<{ id: string; name: string }>>(
      "companies?select=id,name&deleted_at=is.null&order=name.asc&limit=1000"
    );
    // Best-effort: lets callers (e.g. İçerik Takip) default-select HK
    // Dijital's own row without doing their own company lookup/search —
    // resolution stays entirely server-side. Never fails the whole list if
    // HK Dijital's row is momentarily unresolvable.
    const selfId = await resolveHkDijitalCompanyId().catch(() => null);
    return NextResponse.json({
      companies: companies.map((c) => ({ ...c, isHkDijitalSelf: c.id === selfId }))
    });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

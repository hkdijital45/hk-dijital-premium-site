import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";

// Minimal id/name company picker for the Director tab and Hazır İş Akışları
// (Playbook) customer selector. A generic /api/admin/companies list already
// exists but is gated on "growth-intelligence" — reusing it here would
// incorrectly deny a user who has ai-workforce access but not
// growth-intelligence, so this stays a small, separately-gated endpoint
// rather than widening an unrelated route's permission.
export async function GET() {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ companies: [] });

  const companies = await supabaseRest<Array<{ id: string; name: string }>>(
    "companies?select=id,name&deleted_at=is.null&order=name.asc&limit=1000"
  ).catch(() => []);
  return NextResponse.json({ companies });
}

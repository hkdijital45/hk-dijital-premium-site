import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

// A minimal id/name company picker list, reused by any admin screen that
// needs a customer dropdown (e.g. Gemini Görünürlük Merkezi) without
// pulling the full customer record set that /api/admin/customers/export
// or the CRM dashboard load.
export async function GET() {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ companies: [] });

  try {
    const companies = await supabaseRest<Array<{ id: string; name: string }>>(
      "companies?select=id,name&deleted_at=is.null&order=name.asc&limit=1000"
    );
    return NextResponse.json({ companies });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

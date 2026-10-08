import { NextResponse } from "next/server";
import { requireMobileStaffSession } from "@/lib/mobile-auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { getCustomerIntegrations } from "@/lib/marketing-intelligence/customers";

const FIELDS = "id,name,sector,city,website,lifecycle_stage,created_at";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = requireMobileStaffSession(request);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const { id } = await context.params;
  try {
    const rows = await supabaseRest<Array<Record<string, unknown>>>(`companies?select=${FIELDS}&id=eq.${encodeURIComponent(id)}&deleted_at=is.null&limit=1`);
    const company = rows[0];
    if (!company) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });

    const integrations = await getCustomerIntegrations(id).catch(() => null);
    return NextResponse.json({ company, integrations });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

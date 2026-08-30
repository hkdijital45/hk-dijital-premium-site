import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

async function requireStaff() {
  const session = await getSession();
  return session && isStaffRole(session.role) ? session : null;
}

export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ contracts: [] });

  const companyId = new URL(request.url).searchParams.get("companyId");
  const filters = ["select=*,companies(name),sla_definitions(*)", "order=end_date.asc", "limit=200"];
  if (companyId) filters.push(`company_id=eq.${encodeURIComponent(companyId)}`);

  try {
    const contracts = await supabaseRest<Array<Record<string, unknown>>>(`contracts?${filters.join("&")}`);
    return NextResponse.json({ contracts });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = String(body.companyId || "");
  const title = String(body.title || "").trim();
  const startDate = String(body.startDate || "");
  const endDate = String(body.endDate || "");
  if (!companyId || !title || !startDate || !endDate) {
    return NextResponse.json({ error: "companyId, title, startDate ve endDate zorunludur." }, { status: 400 });
  }

  try {
    const inserted = await supabaseRest<Array<Record<string, unknown>>>("contracts", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        title,
        start_date: startDate,
        end_date: endDate,
        auto_renew: Boolean(body.autoRenew),
        status: "active",
        created_by: session.profileId || null
      })
    });
    return NextResponse.json({ contract: inserted[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

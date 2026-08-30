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
  if (!hasSupabaseConfig()) return NextResponse.json({ tests: [] });

  const companyId = new URL(request.url).searchParams.get("companyId");
  const filters = ["select=*", "order=created_at.desc", "limit=100"];
  if (companyId) filters.push(`company_id=eq.${encodeURIComponent(companyId)}`);

  try {
    const tests = await supabaseRest<Array<Record<string, unknown>>>(`ab_tests?${filters.join("&")}`);
    return NextResponse.json({ tests });
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
  const name = String(body.name || "").trim();
  if (!companyId || !name) return NextResponse.json({ error: "companyId ve name zorunludur." }, { status: 400 });

  try {
    const inserted = await supabaseRest<Array<Record<string, unknown>>>("ab_tests", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        campaign_id: body.campaignId || null,
        name,
        variant_a_asset_id: body.variantAAssetId || null,
        variant_b_asset_id: body.variantBAssetId || null,
        start_date: body.startDate || new Date().toISOString().slice(0, 10),
        status: "running"
      })
    });
    return NextResponse.json({ test: inserted[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

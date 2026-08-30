import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { computePricingRecommendation } from "@/lib/dynamic-pricing";

export async function GET(request: Request) {
  const session = await requireModuleAccess("teklifler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ recommendations: [] });

  const leadId = new URL(request.url).searchParams.get("leadId");
  const filters = ["select=*", "order=created_at.desc", "limit=50"];
  if (leadId) filters.push(`lead_id=eq.${encodeURIComponent(leadId)}`);

  try {
    const recommendations = await supabaseRest<Array<Record<string, unknown>>>(`pricing_recommendations?${filters.join("&")}`);
    return NextResponse.json({ recommendations });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("teklifler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const serviceSlugs = Array.isArray(body.serviceSlugs) ? body.serviceSlugs.map((item) => String(item)) : [];
  if (!serviceSlugs.length) return NextResponse.json({ error: "En az bir hizmet paketi seçin." }, { status: 400 });

  try {
    const recommendation = await computePricingRecommendation({
      serviceSlugs,
      leadId: body.leadId ? String(body.leadId) : null,
      companyId: body.companyId ? String(body.companyId) : null,
      createdBy: session.profileId || null
    });
    return NextResponse.json({ recommendation });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Öneri oluşturulamadı." }, { status: 500 });
  }
}

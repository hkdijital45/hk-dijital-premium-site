import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await requireModuleAccess("hazirlik");
  if (!session) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  const body = await request.json();
  try {
    const rows = await supabaseRest<any[]>("preparation_notes?on_conflict=company_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        company_id: body.company_id || null,
        customer_checklist: body.customer_checklist || [],
        campaign_checklist: body.campaign_checklist || [],
        brand_analysis: body.brand_analysis || "",
        swot_notes: body.swot_notes || "",
        target_audience_notes: body.target_audience_notes || "",
        offer_positioning: body.offer_positioning || "",
        funnel_planning: body.funnel_planning || "",
        content_ideas: body.content_ideas || "",
        ad_angle_ideas: body.ad_angle_ideas || "",
        prompt_shortcuts: body.prompt_shortcuts || "",
        updated_by: session.profileId || null,
        updated_at: new Date().toISOString()
      })
    });
    await recordActivity({ session, action: "Güncelleme", entity: "Hazırlık Merkezi", entityId: rows[0]?.id, companyId: rows[0]?.company_id, details: { message: "Hazırlık notları kaydedildi" } });
    return NextResponse.json({ ok: true, note: rows[0], message: "Hazırlık notları kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import type { GeminiVisibilityProfile } from "@/lib/gemini-visibility/types";

export async function GET(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ profile: null });

  const companyId = new URL(request.url).searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId zorunludur." }, { status: 400 });

  try {
    const rows = await supabaseRest<GeminiVisibilityProfile[]>(`gemini_visibility_profiles?company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`);
    return NextResponse.json({ profile: rows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = String(body.companyId || "").trim();
  const businessName = String(body.businessName || "").trim();
  if (!companyId) return NextResponse.json({ error: "companyId zorunludur." }, { status: 400 });
  if (!businessName) return NextResponse.json({ error: "İşletme adı zorunludur." }, { status: 400 });

  const alternateNames = Array.isArray(body.alternateNames)
    ? body.alternateNames.map((name) => String(name).trim()).filter(Boolean).slice(0, 10)
    : [];

  const payload = {
    company_id: companyId,
    business_name: businessName,
    alternate_names: alternateNames,
    sector: body.sector ? String(body.sector).trim() : null,
    city: body.city ? String(body.city).trim() : null,
    district: body.district ? String(body.district).trim() : null,
    website: body.website ? String(body.website).trim() : null,
    service_summary: body.serviceSummary ? String(body.serviceSummary).trim().slice(0, 2000) : null,
    tracking_enabled: body.trackingEnabled !== false
  };

  try {
    const existing = await supabaseRest<Array<{ id: string }>>(`gemini_visibility_profiles?company_id=eq.${encodeURIComponent(companyId)}&select=id&limit=1`);
    if (existing.length) {
      const updated = await supabaseRest<GeminiVisibilityProfile[]>(`gemini_visibility_profiles?id=eq.${encodeURIComponent(existing[0].id)}`, {
        method: "PATCH", body: JSON.stringify(payload)
      });
      return NextResponse.json({ profile: updated[0] });
    }
    const created = await supabaseRest<GeminiVisibilityProfile[]>("gemini_visibility_profiles", {
      method: "POST", body: JSON.stringify({ ...payload, created_by: session.profileId || null })
    });
    return NextResponse.json({ profile: created[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";
import { uuidPattern } from "@/lib/meta-pixel-admin";

export async function POST(request: Request) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const companyId = String(body.companyId || "");
  if (!uuidPattern.test(companyId)) return NextResponse.json({ error: "Geçerli bir müşteri seçin." }, { status: 400 });
  if (!String(body.company?.name || "").trim()) return NextResponse.json({ error: "Müşteri adı zorunludur." }, { status: 400 });

  try {
    const companyRows = await supabaseRest<any[]>(`companies?id=eq.${encodeURIComponent(companyId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: String(body.company.name).trim(),
        phone: String(body.company.phone || "").trim(),
        email: String(body.company.email || "").trim(),
        website: String(body.company.website || "").trim(),
        lifecycle_stage: body.complete ? "Aktif Müşteri" : body.company.lifecycle_stage || "Onboarding",
        updated_at: new Date().toISOString()
      })
    });
    if (!companyRows[0]) return NextResponse.json({ error: "Müşteri kaydı bulunamadı." }, { status: 404 });

    const now = new Date().toISOString();
    const brandingPayload = {
      company_id: companyId,
      brand_name: String(body.branding?.brand_name || body.company.name).trim(),
      logo_url: String(body.branding?.logo_url || "").trim(),
      primary_color: String(body.branding?.primary_color || "#22d3ee"),
      secondary_color: String(body.branding?.secondary_color || "#2563eb"),
      welcome_text: String(body.branding?.welcome_text || "").trim(),
      report_title: String(body.branding?.report_title || "").trim(),
      contact_phone: String(body.branding?.contact_phone || body.company.phone || "").trim(),
      contact_email: String(body.branding?.contact_email || body.company.email || "").trim(),
      contact_whatsapp: String(body.branding?.contact_whatsapp || "").trim(),
      onboarding_data: body.onboardingData || {},
      onboarding_completed_at: body.complete ? now : null,
      updated_at: now
    };
    const brandingRows = await supabaseRest<any[]>("customer_branding?on_conflict=company_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(brandingPayload)
    });
    if (!brandingRows[0]) throw new Error("Müşteri markalama kaydı oluşturulamadı.");

    await recordActivity({ session, action: "Güncelleme", entity: "Müşteri Kurulumu", entityId: companyId, companyId, details: { message: body.complete ? "Müşteri kurulumu tamamlandı" : "Müşteri kurulumu güncellendi", result: "Başarılı" } });
    return NextResponse.json({ ok: true, company: companyRows[0], branding: brandingRows[0], message: body.complete ? "Müşteri kurulumu tamamlandı." : "Müşteri kurulumu kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Müşteri Kurulumu", action: "Onboarding kaydı", error, entityId: companyId, companyId }).catch(() => null);
    return NextResponse.json({ error: safe.title, detail: safe.detail }, { status: 500 });
  }
}

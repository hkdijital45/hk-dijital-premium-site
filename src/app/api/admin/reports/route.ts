import { NextResponse } from "next/server";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";

const reportTypes = ["Meta Reklam Raporu", "Google Ads Raporu", "Sosyal Medya Yönetimi Raporu", "Genel Dijital Performans Raporu"];

function normalize(body: any) {
  if (!body.company_id) throw new Error("Zorunlu alan eksik: Firma seçin.");
  if (!reportTypes.includes(body.report_type)) throw new Error("Zorunlu alan eksik: Rapor türü seçin.");
  return {
    company_id: body.company_id,
    campaign_id: body.campaign_id || null,
    report_type: body.report_type,
    platform: body.platform || null,
    period: body.period || null,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    metrics: body.metrics || {},
    time_series: body.time_series || [],
    raw_extracted_data: body.raw_extracted_data || {},
    internal_note: body.internal_note || null,
    customer_note: body.customer_note || null,
    visible_to_customer: body.visible_to_customer ?? true,
    archived: body.archived ?? false,
    updated_at: new Date().toISOString()
  };
}

async function staffSession() {
  return requireModuleAccess("raporlar");
}

export async function POST(request: Request) {
  const session = await staffSession();
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  try {
    const rows = await supabaseRest<any[]>("reports", { method: "POST", body: JSON.stringify(normalize(await request.json())) });
    await recordActivity({ session, action: "Oluşturma", entity: "Rapor", entityId: rows[0]?.id, companyId: rows[0]?.company_id, details: { message: "Yeni rapor oluşturuldu", report_type: rows[0]?.report_type } });
    return NextResponse.json({ ok: true, report: rows[0], message: "Rapor başarıyla kaydedildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("Rapor oluşturma hatası:", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await staffSession();
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
    const rows = await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(body.id)}`, { method: "PATCH", body: JSON.stringify(normalize(body)) });
    await recordActivity({ session, action: "Güncelleme", entity: "Rapor", entityId: rows[0]?.id, companyId: rows[0]?.company_id, details: { message: "Rapor güncellendi", report_type: rows[0]?.report_type } });
    return NextResponse.json({ ok: true, report: rows[0], message: "Rapor başarıyla güncellendi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("Rapor güncelleme hatası:", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await staffSession();
  if (!session) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  try {
    const { id } = await request.json();
    const rows = await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(id)}&select=*`);
    if (!rows[0]) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
    await supabaseRest(`reports?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    await recordActivity({ session, action: "Silme", entity: "Rapor", entityId: id, companyId: rows[0].company_id, details: { message: "Rapor silindi", report_type: rows[0].report_type } });
    return NextResponse.json({ ok: true, message: "Rapor silindi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    console.error("Rapor silme hatası:", safe.detail);
    return NextResponse.json({ error: safe.title, supabaseError: safe.detail }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError } from "@/lib/supabase";
import { supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json();
  const report = (await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(id)}&select=id,company_id&limit=1`))[0];
  if (!report) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
  const payload = { report_id: id, company_id: report.company_id, update_date: body.update_date || new Date().toISOString().slice(0, 10), title: body.title || "Ajans güncellemesi", category: body.category || "Raporlama", status: body.status || "Yapıldı", customer_note: body.customer_note || null, agency_comment: body.agency_comment || null, next_action: body.next_action || null, ai_comment: body.ai_comment || null, is_visible_to_customer: body.is_visible_to_customer ?? true, is_pinned: body.is_pinned ?? false, created_by: session.profileId || null };
  let rows;
  try {
    rows = await supabaseRest<any[]>("report_updates", { method: "POST", body: JSON.stringify(payload) });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    if (!safeError.detail.includes("category") && !safeError.detail.includes("status")) throw error;
    const { category: _category, status: _status, ...fallbackPayload } = payload;
    rows = await supabaseRest<any[]>("report_updates", { method: "POST", body: JSON.stringify(fallbackPayload) });
  }
  await recordActivity({ session, action: "Oluşturma", entity: "Rapor Notu", entityId: rows[0]?.id, companyId: report.company_id, details: { message: "Rapora ajans notu eklendi" } });
  return NextResponse.json({ ok: true, update: rows[0], message: "Ajans notu kaydedildi." });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Güncelleme kaydı seçilmedi." }, { status: 400 });
  const report = (await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(id)}&select=id,company_id&limit=1`))[0];
  if (!report) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
  const payload = { update_date: body.update_date, title: body.title, category: body.category, status: body.status, customer_note: body.customer_note, agency_comment: body.agency_comment, next_action: body.next_action, is_visible_to_customer: body.is_visible_to_customer, is_pinned: body.is_pinned };
  let rows;
  try {
    rows = await supabaseRest<any[]>(`report_updates?id=eq.${encodeURIComponent(body.id)}&report_id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    if (!safeError.detail.includes("category") && !safeError.detail.includes("status")) throw error;
    const { category: _category, status: _status, ...fallbackPayload } = payload;
    rows = await supabaseRest<any[]>(`report_updates?id=eq.${encodeURIComponent(body.id)}&report_id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(fallbackPayload) });
  }
  await recordActivity({ session, action: "Güncelleme", entity: "Rapor Notu", entityId: body.id, companyId: report.company_id, details: { message: "Rapor ajans notu güncellendi" } });
  return NextResponse.json({ ok: true, update: rows[0], message: "Ajans notu güncellendi." });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Silinecek kayıt seçilmedi." }, { status: 400 });
  const report = (await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(id)}&select=id,company_id&limit=1`))[0];
  if (!report) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
  await supabaseRest(`report_updates?id=eq.${encodeURIComponent(body.id)}&report_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  await recordActivity({ session, action: "Silme", entity: "Rapor Notu", entityId: body.id, companyId: report.company_id, details: { message: "Rapor ajans notu silindi" } });
  return NextResponse.json({ ok: true, message: "Ajans notu silindi." });
}

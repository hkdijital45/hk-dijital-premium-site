import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json();
  const report = (await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(id)}&select=id,company_id&limit=1`))[0];
  if (!report) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
  const rows = await supabaseRest<any[]>("report_updates", { method: "POST", body: JSON.stringify({ report_id: id, company_id: report.company_id, update_date: body.update_date || new Date().toISOString().slice(0, 10), title: body.title || "Ajans güncellemesi", customer_note: body.customer_note || null, agency_comment: body.agency_comment || null, next_action: body.next_action || null, ai_comment: body.ai_comment || null, is_visible_to_customer: body.is_visible_to_customer ?? true, is_pinned: body.is_pinned ?? false, created_by: session.profileId || null }) });
  await recordActivity({ session, action: "Oluşturma", entity: "Rapor Notu", entityId: rows[0]?.id, companyId: report.company_id, details: { message: "Rapora ajans notu eklendi" } });
  return NextResponse.json({ ok: true, update: rows[0], message: "Ajans notu kaydedildi." });
}

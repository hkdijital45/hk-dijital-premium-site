import { NextResponse } from "next/server";
import { getSession, isCustomerRole, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { supabaseRest } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Bu sayfaya erişim yetkiniz yok." }, { status: 403 });
  const { reportId } = await request.json();
  const rows = await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(reportId)}&select=id,company_id,report_type,visible_to_customer&limit=1`);
  const report = rows[0];
  if (!report || (isCustomerRole(session.role) && (report.company_id !== session.companyId || !report.visible_to_customer)) || (!isCustomerRole(session.role) && !isStaffRole(session.role))) {
    return NextResponse.json({ error: "Bu raporu görüntüleme yetkiniz yok." }, { status: 403 });
  }
  await recordActivity({ session, action: "Görüntüleme", entity: "Rapor", entityId: report.id, companyId: report.company_id, details: { message: "Müşteri raporu görüntüledi", report_type: report.report_type } });
  return NextResponse.json({ ok: true });
}

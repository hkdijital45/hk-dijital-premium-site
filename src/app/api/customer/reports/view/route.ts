import { NextResponse } from "next/server";
import { getSession, isCustomerRole, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { supabaseRest } from "@/lib/supabase";
import { canSessionAccessResourceBranch } from "@/lib/server/branch-access";

type CustomerReportAccessRow = { id: string; company_id: string; branch_id?: string | null; report_type?: string | null; visible_to_customer?: boolean | null };

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Bu sayfaya erişim yetkiniz yok." }, { status: 403 });
  const { reportId } = await request.json();
  const rows = await supabaseRest<CustomerReportAccessRow[]>(`reports?id=eq.${encodeURIComponent(reportId)}&select=id,company_id,branch_id,report_type,visible_to_customer&limit=1`);
  const report = rows[0];
  if (!report || (isCustomerRole(session.role) && (report.company_id !== session.companyId || !report.visible_to_customer)) || (!isCustomerRole(session.role) && !isStaffRole(session.role))) {
    return NextResponse.json({ error: "Bu raporu görüntüleme yetkiniz yok." }, { status: 403 });
  }
  if (isCustomerRole(session.role) && !(await canSessionAccessResourceBranch(session, report.company_id, report.branch_id))) {
    return NextResponse.json({ error: "Bu şubeye ait raporu görüntüleme yetkiniz yok." }, { status: 403 });
  }
  await recordActivity({ session, action: "Görüntüleme", entity: "Rapor", entityId: report.id, companyId: report.company_id, details: { message: "Müşteri raporu görüntüledi", report_type: report.report_type } });
  return NextResponse.json({ ok: true });
}

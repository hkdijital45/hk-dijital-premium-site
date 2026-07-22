import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { sendReportEmail } from "@/lib/reports/report-email";
import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";
import { uuidPattern } from "@/lib/meta-pixel-admin";

// Real send flow for the Aylık Rapor Merkezi (monthly_reports table) — this
// table has no dedicated export/send route yet (unlike the "reports" table,
// see /api/admin/reports/[id]/send-email). Reuses the same Resend-backed
// sendReportEmail() helper; only the report lookup/body-building is new
// since monthly_reports has a different shape (summary/meta_metrics/
// google_metrics/social_metrics/ai_interpretation/next_month_recommendations
// rather than the campaign-metrics report shape the other route expects).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Bu rapor henüz kaydedilmemiş. Önce üst çubuktaki Kaydet ile kalıcı hale getirin." }, { status: 400 });

  try {
    const body = await request.json().catch(() => ({}));
    const reportRows = await supabaseRest<any[]>(`monthly_reports?id=eq.${id}&select=*&limit=1`);
    const report = reportRows[0];
    if (!report) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });

    const companyRows = await supabaseRest<any[]>(`companies?id=eq.${report.company_id}&select=id,name,email&limit=1`);
    const company = companyRows[0];
    if (!company?.email) return NextResponse.json({ error: "Müşteri e-posta adresi eksik." }, { status: 400 });

    const message = [
      `${company.name} için ${report.report_month} dönemi aylık rapor:`,
      "",
      report.summary || "",
      report.ai_interpretation ? `\nYapay zekâ yorumu:\n${report.ai_interpretation}` : "",
      report.next_month_recommendations ? `\nGelecek ay önerileri:\n${report.next_month_recommendations}` : ""
    ].filter(Boolean).join("\n");

    await sendReportEmail({
      to: company.email,
      subject: body.subject || `HK Dijital ${report.report_month} aylık raporunuz`,
      message: body.message || message
    });

    await supabaseRest(`monthly_reports?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "Yayınlandı" }) });
    await recordActivity({ session, action: "Dışa Aktarma", entity: "Aylık Rapor E-postası", entityId: id, companyId: report.company_id, details: { message: "Aylık rapor müşteriye e-posta ile gönderildi" } }).catch(() => null);
    return NextResponse.json({ ok: true, message: "Rapor müşteriye e-posta ile gönderildi." });
  } catch (error) {
    const safe = getSafeSupabaseError(error);
    await recordActionFailure({ session, entity: "Aylık Rapor E-postası", action: "E-posta gönderme", error, entityId: id }).catch(() => null);
    return NextResponse.json({ error: error instanceof Error ? error.message : "E-posta gönderilemedi.", detail: safe.detail }, { status: 500 });
  }
}

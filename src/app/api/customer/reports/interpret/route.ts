import { NextResponse } from "next/server";
import { getSession, isCustomerRole, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { interpretReport } from "@/lib/report-interpretation";
import { supabaseRest } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Bu sayfaya erişim yetkiniz yok." }, { status: 403 });
    const { reportId } = await request.json();
    const rows = await supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(reportId)}&select=*&limit=1`);
    const report = rows[0];
    if (!report || (isCustomerRole(session.role) && (report.company_id !== session.companyId || !report.visible_to_customer)) || (!isCustomerRole(session.role) && !isStaffRole(session.role))) {
      return NextResponse.json({ error: "Bu raporu yorumlama yetkiniz yok." }, { status: 403 });
    }

    await recordActivity({ session, action: "Görüntüleme", entity: "Rapor Yorumu", entityId: report.id, companyId: report.company_id, details: { message: "Rapor yorumlama istendi", report_type: report.report_type } });
    const interpretation = await interpretReport(report);
    const saved = await supabaseRest<any[]>("report_interpretations", {
      method: "POST",
      body: JSON.stringify({
        report_id: report.id,
        company_id: report.company_id,
        generated_by_user_id: session.profileId || null,
        interpretation_text: interpretation.text,
        provider: interpretation.provider
      })
    });
    await recordActivity({ session, action: "Oluşturma", entity: "Rapor Yorumu", entityId: saved[0]?.id, companyId: report.company_id, details: { message: "Yapay zekâ rapor yorumu oluşturuldu", provider: interpretation.provider, model: interpretation.model, mode: interpretation.mode } });
    return NextResponse.json({ ok: true, interpretation: { ...saved[0], provider: interpretation.provider, model: interpretation.model, mode: interpretation.mode, isDemo: interpretation.isDemo, isLocal: interpretation.isLocal, badge: interpretation.badge } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rapor şu anda yorumlanamadı. Lütfen daha sonra yeniden deneyin.";
    console.error("Rapor yorumlama hatası:", message);
    return NextResponse.json({ error: message.includes("Seçilen AI sağlayıcısı") ? message : "Rapor şu anda yorumlanamadı. Lütfen daha sonra yeniden deneyin." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSession, isCustomerPasswordChangeRequired, isCustomerRole, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { interpretReport } from "@/lib/report-interpretation";
import { aggregateCustomerReports, getCustomerDateRange, platformFilterLabel, type CustomerPlatformFilter } from "@/lib/reports/customer-period";
import { supabaseRest } from "@/lib/supabase";
import { canSessionAccessResourceBranch } from "@/lib/server/branch-access";

type CustomerReportRow = Record<string, unknown> & {
  id: string;
  company_id: string;
  branch_id?: string | null;
  visible_to_customer?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
};

type SavedInterpretationRow = Record<string, unknown> & { id?: string };

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (isCustomerPasswordChangeRequired(session)) return NextResponse.json({ error: "Önce geçici şifrenizi değiştirmeniz gerekiyor.", redirectTo: "/sifre-degistir" }, { status: 403 });
    if (!session) return NextResponse.json({ error: "Bu sayfaya erişim yetkiniz yok." }, { status: 403 });
    const body = await request.json();
    const reportIds = Array.from(new Set([...(Array.isArray(body.reportIds) ? body.reportIds : []), body.reportId].filter(Boolean))).slice(0, 25);
    if (!reportIds.length) return NextResponse.json({ error: "Yorumlanacak rapor bulunamadı." }, { status: 400 });

    const rows = await supabaseRest<CustomerReportRow[]>(`reports?id=in.(${reportIds.map((id) => encodeURIComponent(String(id))).join(",")})&select=*`);
    if (!rows.length) return NextResponse.json({ error: "Yorumlanacak rapor bulunamadı." }, { status: 404 });
    const forbidden = rows.some((report) => (isCustomerRole(session.role) && (report.company_id !== session.companyId || !report.visible_to_customer)) || (!isCustomerRole(session.role) && !isStaffRole(session.role)));
    if (forbidden) {
      return NextResponse.json({ error: "Bu raporu yorumlama yetkiniz yok." }, { status: 403 });
    }
    if (isCustomerRole(session.role)) {
      const branchChecks = await Promise.all(rows.map((report) => canSessionAccessResourceBranch(session, report.company_id, report.branch_id)));
      if (branchChecks.some((allowed) => !allowed)) return NextResponse.json({ error: "Yetkili olmadığınız bir şubeye ait rapor seçildi." }, { status: 403 });
    }

    const firstReport = rows[0];
    const filters = body.filters || {};
    const platform = (filters.platform || "all") as CustomerPlatformFilter;
    const range = getCustomerDateRange("custom", filters.start || firstReport.start_date || firstReport.end_date, filters.end || firstReport.end_date || firstReport.start_date);
    const selectedReport = aggregateCustomerReports(rows, range, platform);
    selectedReport.report_type = platform === "all" ? "Seçilen Dönem Müşteri Performans Raporu" : `${platformFilterLabel(platform)} Müşteri Performans Raporu`;

    await recordActivity({ session, action: "Görüntüleme", entity: "Rapor Yorumu", entityId: firstReport.id, companyId: firstReport.company_id, details: { message: "Seçili dönem rapor yorumu istendi", report_type: selectedReport.report_type, period: range.label, platform: platformFilterLabel(platform) } });
    const interpretation = await interpretReport(selectedReport);
    const saved = await supabaseRest<SavedInterpretationRow[]>("report_interpretations", {
      method: "POST",
      body: JSON.stringify({
        report_id: firstReport.id,
        company_id: firstReport.company_id,
        branch_id: firstReport.branch_id || null,
        generated_by_user_id: session.profileId || null,
        interpretation_text: interpretation.text,
        provider: interpretation.provider
      })
    });
    await recordActivity({ session, action: "Oluşturma", entity: "Rapor Yorumu", entityId: saved[0]?.id, companyId: firstReport.company_id, details: { message: "Yapay zekâ seçili dönem rapor yorumu oluşturuldu", provider: interpretation.provider, model: interpretation.model, mode: interpretation.mode, period: range.label, platform: platformFilterLabel(platform) } });
    return NextResponse.json({ ok: true, interpretation: { ...saved[0], provider: interpretation.provider, model: interpretation.model, mode: interpretation.mode, isDemo: interpretation.isDemo, isLocal: interpretation.isLocal, badge: interpretation.badge, period: range.label, platform: platformFilterLabel(platform) } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rapor şu anda yorumlanamadı. Lütfen daha sonra yeniden deneyin.";
    console.error("Rapor yorumlama hatası:", message);
    return NextResponse.json({ error: message.includes("Seçilen AI sağlayıcısı") ? message : "Rapor şu anda yorumlanamadı. Lütfen daha sonra yeniden deneyin." }, { status: 500 });
  }
}

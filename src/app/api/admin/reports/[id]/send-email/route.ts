import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { sendReportEmail } from "@/lib/reports/report-email";
import { generateReportExport, type ExportFormat } from "@/lib/reports/report-exports";
import { getReportBundle } from "@/lib/reports/report-server";
import { supabaseRest } from "@/lib/supabase";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  const { id } = await context.params;
  try {
    const body = await request.json();
    const bundle = await getReportBundle(id);
    if (!bundle.company?.email) return NextResponse.json({ error: "Müşteri e-posta adresi eksik." }, { status: 400 });
    const formats = (body.formats || []).filter((format: string) => ["excel", "word", "pdf"].includes(format)) as ExportFormat[];
    const attachments = await Promise.all(formats.map(async (format) => {
      const file = await generateReportExport(format, bundle.report, bundle.company, bundle.interpretation, bundle.updates);
      return { filename: `hk-dijital-rapor.${file.extension}`, content: file.buffer };
    }));
    await sendReportEmail({ to: bundle.company.email, subject: body.subject || "HK Dijital performans raporunuz", message: body.message || "Güncel performans raporunuzu müşteri panelinizden inceleyebilirsiniz.", attachments });
    await supabaseRest(`reports?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ sent_at: new Date().toISOString() }) });
    await recordActivity({ session, action: "Dışa Aktarma", entity: "Rapor E-postası", entityId: id, companyId: bundle.report.company_id, details: { message: "Rapor müşteriye e-posta ile gönderildi" } });
    return NextResponse.json({ ok: true, message: "Rapor müşteriye e-posta ile gönderildi." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "E-posta gönderilemedi." }, { status: 500 });
  }
}

import { interpretReport } from "../report-interpretation";
import { supabaseRest } from "../supabase";

export async function getReportBundle(reportId: string) {
  const [reports, interpretations, updates] = await Promise.all([
    supabaseRest<any[]>(`reports?id=eq.${encodeURIComponent(reportId)}&select=*&limit=1`),
    supabaseRest<any[]>(`report_interpretations?report_id=eq.${encodeURIComponent(reportId)}&select=*&order=created_at.desc&limit=1`),
    supabaseRest<any[]>(`report_updates?report_id=eq.${encodeURIComponent(reportId)}&is_visible_to_customer=eq.true&select=*&order=is_pinned.desc,update_date.desc`)
  ]);
  const report = reports[0];
  if (!report) throw new Error("Rapor bulunamadı.");
  const company = (await supabaseRest<any[]>(`companies?id=eq.${report.company_id}&select=*&limit=1`))[0];
  let interpretation = interpretations[0];
  if (!interpretation) {
    const generated = await interpretReport(report);
    interpretation = (await supabaseRest<any[]>("report_interpretations", { method: "POST", body: JSON.stringify({ report_id: report.id, company_id: report.company_id, interpretation_text: generated.text, provider: generated.provider }) }))[0];
  }
  return { report, company, interpretation, updates };
}

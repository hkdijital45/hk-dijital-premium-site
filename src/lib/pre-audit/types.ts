// Ön İnceleme Merkezi — shared types/constants. See
// supabase/migrations/20260920_pre_audit_reports.sql for the table this
// mirrors.

export const PRE_AUDIT_TABLE = "pre_audit_reports";

export const PRE_AUDIT_REPORT_TYPES = ["INTERNAL_REPORT", "CLIENT_REPORT"] as const;
export type PreAuditReportType = (typeof PRE_AUDIT_REPORT_TYPES)[number];

// Fields never present on a CLIENT_REPORT row — enforced server-side in
// reports.ts (savePreAuditReport strips them for that report_type) and
// again in the admin UI (defence in depth: never rendered for
// CLIENT_REPORT even if a row somehow carried a value).
export const PRE_AUDIT_INTERNAL_ONLY_FIELDS = [
  "sales_notes", "sales_script", "instagram_dm", "whatsapp_initial", "whatsapp_with_pdf", "objections"
] as const;

export type PreAuditReport = {
  id: string;
  company_id: string;
  analysis_group_id: string;
  report_type: PreAuditReportType;
  title: string;
  status: string;
  report_date: string;

  executive_summary: string;
  digital_presence: unknown;
  google_analysis: unknown;
  maps_analysis: unknown;
  website_analysis: unknown;
  seo_analysis: unknown;
  social_analysis: unknown;
  meta_ads_analysis: unknown;
  google_ads_analysis: unknown;
  market_analysis: unknown;
  competitor_analysis: unknown;
  swot: unknown;
  digital_gaps: unknown;
  opportunities: unknown;
  recommended_services: unknown;
  recommended_package: unknown;
  ad_strategy: unknown;
  budget_plan: unknown;
  sources: unknown;

  sales_notes: string;
  sales_script: string;
  instagram_dm: string;
  whatsapp_initial: string;
  whatsapp_with_pdf: string;
  objections: unknown;

  pdf_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type PreAuditReportListItem = Pick<
  PreAuditReport,
  "id" | "company_id" | "analysis_group_id" | "report_type" | "title" | "status" | "report_date" | "recommended_package" | "created_at"
>;

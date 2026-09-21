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

// Lead pre-review queue lifecycle — stored on public.leads.status (a free-
// text column, no new column needed). Distinct from the general sales
// pipeline's own status values so a pre-review rejection is never
// conflated with a post-contact sales loss.
export const LEAD_PRE_REVIEW_STATUS = {
  PENDING: "Ön İnceleme Bekliyor",
  IN_REVIEW: "Ön İnceleme - İnceleniyor",
  COMPLETED: "Ön İnceleme Tamamlandı",
  REJECTED: "Ön İnceleme İptal"
} as const;

// Shared section label maps — the single source of truth for both the
// admin report viewer (PreAuditCenter.tsx) and the PDF/DOCX document
// builder (pre-audit/document.ts), so the two never drift apart on which
// fields exist or how they're labeled in Turkish.
export const PRE_AUDIT_SECTION_LABELS: Array<[string, string]> = [
  ["executive_summary", "Yönetici Özeti"],
  ["digital_presence", "Dijital Varlıklar"],
  ["google_analysis", "Google"],
  ["maps_analysis", "Google Maps / Local SEO"],
  ["website_analysis", "Web Sitesi"],
  ["seo_analysis", "SEO"],
  ["social_analysis", "Sosyal Medya"],
  ["meta_ads_analysis", "Meta Ads"],
  ["google_ads_analysis", "Google Ads"],
  ["market_analysis", "Pazar Analizi"],
  ["competitor_analysis", "Rakip Analizi"],
  ["digital_gaps", "Dijital Boşluklar"],
  ["opportunities", "Fırsatlar"],
  ["recommended_services", "Önerilen HK Dijital Hizmetleri"],
  ["recommended_package", "Önerilen Paket"],
  ["ad_strategy", "Başlangıç Reklam Stratejisi"],
  ["budget_plan", "Bütçe Planı"],
  ["sources", "Kaynaklar"]
];

// Paired with PRE_AUDIT_INTERNAL_ONLY_FIELDS above (same keys, with Turkish
// display labels) — INTERNAL_REPORT-only, never rendered/exported for
// CLIENT_REPORT.
export const PRE_AUDIT_INTERNAL_SECTION_LABELS: Array<[string, string]> = [
  ["sales_notes", "Satış Görüşmesi Notları"],
  ["sales_script", "Konuşma Metni"],
  ["instagram_dm", "Instagram DM"],
  ["whatsapp_initial", "WhatsApp — İlk Temas"],
  ["whatsapp_with_pdf", "WhatsApp — PDF ile Gönderim"],
  ["objections", "İtirazlar / Yanıtlar"]
];

export const PRE_REVIEW_REJECTION_REASONS = [
  "Uygun müşteri değil",
  "Dijital ihtiyacı düşük",
  "Bütçe potansiyeli düşük",
  "Zaten güçlü dijital altyapısı var",
  "Yanlış / geçersiz işletme",
  "Tekrar kayıt",
  "İletişim kurulması uygun değil",
  "Diğer"
] as const;

export type PreAuditReport = {
  id: string;
  company_id: string | null;
  lead_id: string | null;
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
  "id" | "company_id" | "lead_id" | "analysis_group_id" | "report_type" | "title" | "status" | "report_date" | "recommended_package" | "created_at" | "updated_at"
>;

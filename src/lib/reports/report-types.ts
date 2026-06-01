export const reportTypes = ["Meta Reklam Raporu", "Google Ads Raporu", "Sosyal Medya Yönetimi Raporu", "Genel Dijital Performans Raporu"] as const;
export type ReportType = (typeof reportTypes)[number];

export type ReportRow = {
  id: string;
  company_id: string;
  campaign_id?: string | null;
  report_type: ReportType;
  platform?: string | null;
  period?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  metrics: Record<string, any>;
  time_series?: Array<Record<string, any>>;
  raw_extracted_data?: Record<string, any>;
  internal_note?: string | null;
  customer_note?: string | null;
  visible_to_customer?: boolean;
  archived?: boolean;
  sent_at?: string | null;
};

export type ReportUpdate = {
  id: string;
  report_id: string;
  company_id: string;
  update_date: string;
  title: string;
  customer_note?: string;
  agency_comment?: string;
  next_action?: string;
  ai_comment?: string;
  is_visible_to_customer?: boolean;
  is_pinned?: boolean;
};

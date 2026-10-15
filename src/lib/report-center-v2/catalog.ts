// Rapor Merkezi V2 — typed catalog of every REAL stored report source in
// HK Admin (discovered from the existing tables/builders, nothing
// invented). Client-safe (no I/O). One entry per underlying record type, so
// the same record is never listed twice under two categories.
//
// Identity of a listed report is the compound `${type}:${sourceId}` — ids
// from different tables can never collide.

export type ReportOwnerType = "lead" | "company";
export type ReportVariant = "internal" | "client";

export type ReportCategoryKey = "on-inceleme" | "instagram" | "reklam-doktoru" | "teklif" | "musteri-raporlari" | "diger";

export type ReportTypeKey =
  | "pre_audit_internal" | "pre_audit_client"
  | "instagram_evaluation" | "instagram_profile_audit"
  | "ad_evaluation" | "ad_strategy" | "ad_creative_report" | "candidate_evaluation" | "manual_evaluation"
  | "proposal"
  | "customer_report" | "monthly_report"
  | "analytics_report" | "gemini_visibility" | "content_plan";

export type ReportTypeDefinition = {
  key: ReportTypeKey;
  category: ReportCategoryKey;
  label: string;
  description: string;
  /** Which record source the "Lead / Müşteri" step may use. */
  owners: ReportOwnerType[];
  /** Rows carry business_unit_id (Ana İşletme / şube / bağlı marka). */
  businessUnits: boolean;
  /** Variants the type can render. A single-variant type is the stored row's own variant. */
  variants: ReportVariant[];
  formats: { pdf: boolean; docx: boolean };
  /** Output is an already-stored file (no re-render). */
  storedFile?: boolean;
  /** Any one of these HK Admin modules (in addition to rapor-merkezi). */
  modules: string[];
};

export const REPORT_CATEGORIES: Array<{ key: ReportCategoryKey; label: string; description: string }> = [
  { key: "on-inceleme", label: "Ön İnceleme", description: "Satış öncesi dijital ön inceleme raporları (dahili ve müşteriye özel)." },
  { key: "instagram", label: "Instagram", description: "Instagram değerlendirmeleri ve profil optimizasyonu analizleri." },
  { key: "reklam-doktoru", label: "Reklam Doktoru Pro", description: "Meta reklam değerlendirme, strateji, kreatif ve aday değerlendirme raporları." },
  { key: "teklif", label: "Teklif Merkezi", description: "Lead ve müşteri teklifleri." },
  { key: "musteri-raporlari", label: "Müşteri Raporları", description: "Performans, keşif ve aylık müşteri raporları." },
  { key: "diger", label: "Diğer Raporlar", description: "Analiz merkezi, Gemini görünürlük ve içerik planı raporları." }
];

export const REPORT_TYPES: ReportTypeDefinition[] = [
  { key: "pre_audit_client", category: "on-inceleme", label: "Müşteriye Özel Ön İnceleme", description: "Müşteriye sunulabilir ön inceleme raporu.", owners: ["lead", "company"], businessUnits: true, variants: ["client"], formats: { pdf: true, docx: true }, modules: ["on-inceleme"] },
  { key: "pre_audit_internal", category: "on-inceleme", label: "Dahili Ön İnceleme", description: "Satış notları ve iç değerlendirmeleri içeren dahili rapor.", owners: ["lead", "company"], businessUnits: true, variants: ["internal"], formats: { pdf: true, docx: true }, modules: ["on-inceleme"] },

  { key: "instagram_evaluation", category: "instagram", label: "Instagram Değerlendirmesi", description: "Lead veya müşteri için kaydedilmiş Instagram değerlendirmeleri.", owners: ["lead", "company"], businessUnits: true, variants: ["client", "internal"], formats: { pdf: true, docx: true }, modules: ["ad-insights"] },
  { key: "instagram_profile_audit", category: "instagram", label: "Instagram Profil Analizi", description: "Bağlı müşteri hesabı için profil optimizasyonu analizi.", owners: ["company"], businessUnits: false, variants: ["client"], formats: { pdf: true, docx: true }, modules: ["analiz-raporlama"] },

  { key: "ad_evaluation", category: "reklam-doktoru", label: "Meta Reklam Değerlendirmesi", description: "Yayındaki Meta kampanyasının gerçek performans değerlendirmesi.", owners: ["company"], businessUnits: false, variants: ["client", "internal"], formats: { pdf: true, docx: true }, modules: ["ad-insights"] },
  { key: "ad_strategy", category: "reklam-doktoru", label: "Meta Reklam Stratejisi", description: "Claude ile hazırlanan reklam stratejisi.", owners: ["company"], businessUnits: false, variants: ["client", "internal"], formats: { pdf: true, docx: true }, modules: ["ad-insights"] },
  { key: "ad_creative_report", category: "reklam-doktoru", label: "Kreatif Değerlendirme Raporu", description: "Reklam kreatifleri, çekim/kurgu ve test planı.", owners: ["company"], businessUnits: false, variants: ["client", "internal"], formats: { pdf: true, docx: true }, modules: ["ad-insights"] },
  { key: "candidate_evaluation", category: "reklam-doktoru", label: "Aday Değerlendirmesi", description: "Müşteri adayı uygunluk değerlendirmesi.", owners: ["lead", "company"], businessUnits: true, variants: ["internal"], formats: { pdf: true, docx: true }, modules: ["on-inceleme"] },
  { key: "manual_evaluation", category: "reklam-doktoru", label: "Manuel Değerlendirme", description: "Reklam Doktoru, strateji, kreatif ve değerlendirme sekmelerinde kaydedilen manuel değerlendirmeler.", owners: ["lead", "company"], businessUnits: true, variants: ["client", "internal"], formats: { pdf: true, docx: true }, modules: ["ad-insights"] },

  { key: "proposal", category: "teklif", label: "Teklif", description: "Teklif Merkezi'nde hazırlanan teklifler (arşivlenenler isteğe bağlı).", owners: ["lead", "company"], businessUnits: false, variants: ["client", "internal"], formats: { pdf: true, docx: true }, modules: ["teklifler", "crm", "leads"] },

  { key: "customer_report", category: "musteri-raporlari", label: "Performans ve Keşif Raporu", description: "Raporlar modülündeki performans, AI ve müşteri keşif raporları.", owners: ["lead", "company"], businessUnits: false, variants: ["client"], formats: { pdf: true, docx: true }, modules: ["raporlar"] },
  { key: "monthly_report", category: "musteri-raporlari", label: "Aylık Rapor", description: "Aylık müşteri raporları.", owners: ["company"], businessUnits: false, variants: ["client"], formats: { pdf: true, docx: true }, modules: ["aylik-raporlar"] },

  { key: "analytics_report", category: "diger", label: "Analiz Merkezi Raporu", description: "Analiz & Raporlama Merkezi'nin oluşturduğu kayıtlı PDF raporları.", owners: ["company"], businessUnits: false, variants: ["client"], formats: { pdf: true, docx: false }, storedFile: true, modules: ["analiz-raporlama"] },
  { key: "gemini_visibility", category: "diger", label: "Gemini Görünürlük Raporu", description: "AI görünürlük taramaları.", owners: ["company"], businessUnits: false, variants: ["client"], formats: { pdf: true, docx: true }, modules: ["growth-intelligence"] },
  { key: "content_plan", category: "diger", label: "İçerik Planı", description: "Müşterinin güncel Instagram içerik planı.", owners: ["company"], businessUnits: false, variants: ["client", "internal"], formats: { pdf: true, docx: true }, modules: ["social-autopilot"] }
];

export const REPORT_TYPE_BY_KEY = new Map(REPORT_TYPES.map((t) => [t.key, t]));

export function isReportTypeKey(value: unknown): value is ReportTypeKey {
  return typeof value === "string" && REPORT_TYPE_BY_KEY.has(value as ReportTypeKey);
}

export const VARIANT_LABELS: Record<ReportVariant, string> = { client: "Müşteri", internal: "Dahili" };

/** "pre_audit_client:<uuid>" -> { type, sourceId } (or null). */
export function parseReportRef(ref: string): { type: ReportTypeKey; sourceId: string } | null {
  const index = ref.indexOf(":");
  if (index <= 0) return null;
  const type = ref.slice(0, index);
  const sourceId = ref.slice(index + 1);
  if (!isReportTypeKey(type) || !sourceId) return null;
  return { type, sourceId };
}

/** Owner support message for a type (Turkish UI copy). */
export function ownerSupportLabel(def: ReportTypeDefinition): string {
  if (def.owners.length === 2) return "Lead ve müşteri kayıtları için kullanılabilir.";
  return def.owners[0] === "company" ? "Bu rapor türü yalnızca müşteri kayıtları için tutulur." : "Bu rapor türü yalnızca lead kayıtları için tutulur.";
}

// Deterministic pre-audit prompt. Only values actually stored on the lead are
// written; empty fields are omitted, never rendered as undefined/null/[]/{}.
// Name, email and phone are deliberately excluded from the copied prompt.
import { NOINDEX_EVIDENCE_RULE } from "./pre-audit/evidence-wording.ts";

export type PreAuditLeadSnapshot = {
  company?: string | null;
  business_type?: string | null;
  address?: string | null;
  instagram?: string | null;
  website?: string | null;
  goal?: string | null;
  budget?: string | null;
  platforms_label?: string | null;
  message?: string | null;
  source?: string | null;
  google_maps_url?: string | null;
  pre_analysis?: { contentNeed?: string; startTiming?: string; socialStatus?: string } | null;
};

// Minimal shape actually used here — avoids importing the full
// LeadPreAuditPreparation type (and its server-only module) into this
// plain, isomorphic prompt builder.
export type PreAuditPrepSnapshot = {
  social_observations?: string | null;
  business_notes?: string | null;
  advertising_status?: "yes" | "no" | "unknown" | null;
  potential_reason?: string | null;
  focus_notes?: string | null;
  competitor_reference?: string | null;
  requested_by?: "" | "customer" | "hk_dijital" | "business_owner" | "referral" | "other" | null;
  requested_by_detail?: string | null;
};

const REQUESTED_BY_LABELS: Record<string, string> = {
  customer: "Müşteri kendisi talep etti",
  hk_dijital: "HK Dijital tarafından önerildi / başlatıldı",
  business_owner: "İşletme yetkilisi talep etti",
  referral: "Referans / üçüncü kişi talep etti",
  other: "Diğer"
};

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  const trimmed = String(value).trim();
  return trimmed === "null" || trimmed === "undefined" ? "" : trimmed;
}

function field(label: string, value: string): string[] {
  return value ? [label, value, ""] : [];
}

function requestedByText(prep: PreAuditPrepSnapshot): string {
  const key = prep.requested_by;
  if (!key) return "";
  const label = REQUESTED_BY_LABELS[key];
  if (!label) return "";
  const detail = key === "other" ? text(prep.requested_by_detail) : "";
  return detail ? `${label} — ${detail}` : label;
}

/** Dynamic section, inserted between the form snapshot and GÖREV (per the
 * required 1-6 ordering: fixed intro, business/form info, staff
 * observations, requester info, THEN the existing research tasks/rules).
 * Returns [] entirely (no empty section header) when nothing was filled in. */
function buildStaffNotesSection(prep?: PreAuditPrepSnapshot | null): string[] {
  if (!prep) return [];
  const advertising = prep.advertising_status === "yes" ? "Evet" : prep.advertising_status === "no" ? "Hayır" : "";
  const notesFields = [
    ...field("Ön İncelemeyi Talep Eden:", requestedByText(prep)),
    ...field("Sosyal Medya Gözlemlerim:", text(prep.social_observations)),
    ...field("İşletme Hakkında Notlarım:", text(prep.business_notes)),
    ...field("Reklam Veriyor Mu?:", advertising),
    ...field("Neden Potansiyel Müşteri?:", text(prep.potential_reason)),
    ...field("Özellikle İncelenmesi İstenen Alanlar:", text(prep.focus_notes)),
    ...field("Rakip / Örnek İşletme:", text(prep.competitor_reference))
  ];
  if (!notesFields.length) return [];
  return [
    "HK DİJİTAL İÇ DEĞERLENDİRME NOTLARI",
    "",
    "HK Dijital personelinin paylaştığı gözlemler ve işletme notları araştırma bağlamıdır. Bu bilgileri dikkate al ancak doğrulanmamış iddiaları kesin gerçek olarak sunma. Personel tarafından özellikle incelenmesi istenen alanlara araştırmada öncelik ver. Notları müşterinin doğrudan beyanı ile karıştırma. Ön incelemeyi kimin talep ettiğini doğru yansıt: \"Müşteri kendisi talep etti\" seçili değilse, incelemenin müşterinin kendi talebiyle başladığını varsayma.",
    "",
    ...notesFields
  ];
}

export function buildPreAuditLeadPrompt(leadId: string, lead: PreAuditLeadSnapshot, prep?: PreAuditPrepSnapshot | null): string {
  const pre = lead.pre_analysis || {};
  const formFields = [
    ...field("Firma:", text(lead.company)),
    ...field("Sektör:", text(lead.business_type)),
    ...field("Açık Adres:", text(lead.address)),
    ...field("Instagram:", text(lead.instagram)),
    ...field("Web Sitesi:", text(lead.website)),
    ...field("Google Maps:", text(lead.google_maps_url)),
    ...field("Ana Hedef:", text(lead.goal)),
    ...field("İlgilendiği Platformlar:", text(lead.platforms_label)),
    ...field("Aylık Reklam Bütçesi:", text(lead.budget)),
    ...field("İçerik İhtiyacı:", text(pre.contentNeed)),
    ...field("Başlangıç Zamanlaması:", text(pre.startTiming)),
    ...field("Mevcut Sosyal Medya Durumu:", text(pre.socialStatus)),
    ...field("Müşteri Notu:", text(lead.message)),
    ...field("Lead Kaynağı:", text(lead.source))
  ];
  return [
    "HK DİJİTAL — İŞLETME ÖN İNCELEMESİ",
    "",
    "Aşağıdaki işletme HK Dijital web sitesindeki Dijital Pazarlama Ön Analizi formunu doldurmuştur.",
    "İşletme bilgilerini kullanarak profesyonel bir dijital pazarlama ön incelemesi gerçekleştir.",
    "",
    "FORMDAN GELEN BİLGİLER",
    "",
    ...formFields,
    ...buildStaffNotesSection(prep),
    "GÖREV",
    "",
    "İşletmenin herkese açık dijital varlıklarını araştır ve doğrula: resmi web sitesi, Instagram, Facebook, Google İşletme Profili / Google Maps görünürlüğü, marka tutarlılığı, içerik düzeni, iletişim ve dönüşüm yolları, web sitesi kullanılabilirliği, temel SEO görünürlüğü, yerel arama görünürlüğü ve reklam vermeye uygunluk.",
    "",
    "KRİTİK KURALLAR",
    "",
    "Form verilerini müşterinin beyan ettiği bilgi olarak değerlendir. İnternetten bulunan bilgileri ayrıca doğrula.",
    "Bulamadığın bilgiyi uydurma. Kesin doğrulanamayan bilgiyi kesinmiş gibi yazma.",
    "Reklam hesabına erişimin yoksa aktif reklam performansı hakkında varsayım yapma.",
    "Satış garantisi verme. Gerçek veriye dayanmayan takipçi, trafik, ciro veya reklam sonucu üretme.",
    "",
    NOINDEX_EVIDENCE_RULE,
    "",
    "SONUÇ",
    "",
    "1. İşletme Özeti",
    "2. Mevcut Dijital Görünüm",
    "3. Güçlü Noktalar",
    "4. Geliştirilmesi Gereken Alanlar",
    "5. Reklam Açısından Hazırlık Durumu",
    "6. İçerik/Kreatif İhtiyacı",
    "7. Ölçüm ve Teknik Altyapı",
    "8. İlk 30 Gün İçin Öncelikler",
    "9. HK Dijital Görüşmesinde Sorulması Gereken Sorular",
    "10. Genel Ön Değerlendirme",
    "",
    "Bu bir satış garantisi veya kesin performans tahmini değildir.",
    "",
    `Lead ID: ${leadId}`,
    "Analiz tamamlandığında HK Dijital MCP Ön İnceleme kayıt aracını kullanarak raporu aynı lead ID ile Ön İnceleme Merkezi'ne kaydet.",
    "Yeni lead veya işletme oluşturma. Aynı raporu ikinci kez oluşturma; mevcut kayıt varsa güncel bağlama göre güvenli şekilde işle."
  ].join("\n");
}

// Deterministic pre-audit prompt. Only values actually stored on the lead are
// written; empty fields are omitted, never rendered as undefined/null/[]/{}.
// Name, email and phone are deliberately excluded from the copied prompt.
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
  pre_analysis?: { contentNeed?: string; startTiming?: string; socialStatus?: string } | null;
};

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  const trimmed = String(value).trim();
  return trimmed === "null" || trimmed === "undefined" ? "" : trimmed;
}

function field(label: string, value: string): string[] {
  return value ? [label, value, ""] : [];
}

export function buildPreAuditLeadPrompt(leadId: string, lead: PreAuditLeadSnapshot): string {
  const pre = lead.pre_analysis || {};
  const formFields = [
    ...field("Firma:", text(lead.company)),
    ...field("Sektör:", text(lead.business_type)),
    ...field("Açık Adres:", text(lead.address)),
    ...field("Instagram:", text(lead.instagram)),
    ...field("Web Sitesi:", text(lead.website)),
    ...field("Ana Hedef:", text(lead.goal)),
    ...field("İlgilendiği Platformlar:", text(lead.platforms_label)),
    ...field("Aylık Reklam Bütçesi:", text(lead.budget)),
    ...field("İçerik İhtiyacı:", text(pre.contentNeed)),
    ...field("Başlangıç Zamanlaması:", text(pre.startTiming)),
    ...field("Mevcut Sosyal Medya Durumu:", text(pre.socialStatus)),
    ...field("Müşteri Notu:", text(lead.message))
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

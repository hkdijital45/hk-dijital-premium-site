// Pure, dependency-free prompt builder for "Claude Kreatif Promptunu
// Kopyala" — kept separate from AdCreativeReportPanel.tsx (which pulls in
// React) so it stays trivially unit-testable with a plain node:test run,
// same precedent as instagram-profile-audit-prompt.ts's
// buildInstagramProfileAuditPrompt. Builds a short, dynamic prompt for the
// "HK DİJİTAL — REKLAM KREATİF STRATEJİSTİ & PRODÜKSİYON UZMANI" Claude
// Project: real company name/id + (if already known client-side, at zero
// extra fetch cost) the linked ad strategy version and the existing
// creative report's id/version/status, so Claude can decide save vs.
// update without guessing — never fabricates data itself, always defers
// to get_ad_creative_context as the actual source of truth. Never a
// secret/token.
export type AdCreativeReportPromptContext = {
  adStrategyVersion?: number | null;
  latestReport?: { id: string; version: number; status: string } | null;
};

export function buildAdCreativeClaudePrompt(company: { id: string; name: string }, context: AdCreativeReportPromptContext = {}): string {
  const knownState = [
    context.adStrategyVersion ? `Bağlı Reklam Stratejisi: v${context.adStrategyVersion}` : null,
    context.latestReport ? `Mevcut kreatif rapor: v${context.latestReport.version} (${context.latestReport.status}, id: ${context.latestReport.id})` : "Bu müşteri için henüz kaydedilmiş bir kreatif rapor yok."
  ].filter(Boolean).join("\n");

  const lines = [
    `HK Dijital Reklam Kreatif Uzmanı olarak aşağıdaki müşteri için çalış:`,
    "",
    `Müşteri: ${company.name}`,
    `Company ID: ${company.id}`,
    knownState,
    "",
    "1. Önce get_ad_creative_context(companyId) ile bu müşterinin gerçek bilgilerini, güncel Reklam Stratejisini, varsa Kreatif Brief'i ve mevcut en son kreatif raporun id/version/status'unu al. Reklam Stratejisi ve Kreatif Brief'i tek gerçek kaynak kabul et; context'te olmayan işletme/kampanya/teklif/hedef kitle verisini uydurma.",
    "2. Ayrıntılı, gerçekten üretime geçirilebilecek bir Reklam Kreatif Üretim Raporu hazırla: Kreatif Strateji Özeti, Kreatif Dağılım Planı, her kreatif için ayrı detaylı çalışma (hook, ana mesaj, CTA, reklam metinleri; video/Reels için sahne sahne çekim planı + süre + çekim talimatları + ekran yazıları + seslendirme + kurgu planı; statik için tasarım talimatları; Carousel için slide planı; Story için sekans), A/B test planı, müşteriden istenecek materyaller, prodüksiyon kontrol listesi, kreatif optimizasyon/yenileme önerileri, dahili ajans notları.",
    "3. Müşteri Raporu ile Dahili Rapor içeriğini kesin ayır — ajans içi notlar, internal hypothesis, dahili A/B değerlendirmeleri hiçbir zaman müşteri alanlarına (clientReport, her creative'in genel alanları) sızmasın; bunlar yalnızca internalReport / her creative'in internalNotes alanına yazılsın.",
    "4. Yeni bir rapor hazırlıyorsan save_ad_creative_report kullan (her zaman draft olarak kaydedilir). Yukarıdaki mevcut kreatif rapor varsa ve kullanıcı revizyon istiyorsa save yerine update_ad_creative_report(companyId, reportId, patch) kullan — reportId için mevcut raporun id'sini kullan, gereksiz yeni version oluşturma.",
    "5. Kayıttan sonra get_latest_ad_creative_report ile doğrula. Kullanıcı açıkça onaylamadan raporu approved/active yapma.",
    "6. Sonunda bana kısaca bildir: müşteri, report ID, version, status, bağlı reklam stratejisi/version, HK Admin'e başarıyla kaydedilip kaydedilmediği. Raporu HK Admin'e kaydet; benden manuel kopyala-yapıştır isteme.",
    "7. Yazım kuralları: hiçbir alanda uzun, birden fazla bilgiyi tek paragrafta birleştiren metin yazma — her bilgiyi ayrı bir madde (bullet) olarak yaz. Dijital pazarlama uzmanı olmayan biri anlayacak şekilde sade Türkçe kullan; Hook, CTA, Reels, Funnel, A/B Testi, Remarketing, CTR, Learning Phase, Primary Text, Headline, Description, FPS gibi teknik terimlerin yanına parantez içinde kısa Türkçe karşılığını ekle. Aynı bilgiyi birden fazla başlık altında tekrar etme. Müşteri raporu (clientReport) ile dahili rapor (internalReport/internalNotes) ayrımını kesinlikle koru."
  ];
  return lines.join("\n");
}

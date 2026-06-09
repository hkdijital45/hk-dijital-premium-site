import { generateAiText } from "./ai-provider";

function demoInterpretation(report: any) {
  const metrics = report.metrics || {};
  const clicks = Number(metrics.clicks || 0);
  const impressions = Number(metrics.impressions || 0);
  const leads = Number(metrics.leads || metrics.messages || metrics.conversions || 0);
  const spent = Number(metrics.spent || metrics.cost || 0);
  const reach = Number(metrics.reach || 0);
  return [
    `${report.period || "Bu dönem"} için hazırlanan ${report.report_type.toLocaleLowerCase("tr-TR")} incelendi.`,
    impressions || reach ? `Çalışmalar ${impressions ? `${impressions.toLocaleString("tr-TR")} gösterim` : ""}${impressions && reach ? " ve " : ""}${reach ? `${reach.toLocaleString("tr-TR")} kişilik erişim` : ""} sağlamış.` : "Görünürlük verileri düzenli takip edilmeye devam ediyor.",
    clicks ? `${clicks.toLocaleString("tr-TR")} tıklama alınmış; sonraki dönemde içerik, hedefleme ve teklif uyumu birlikte izlenebilir.` : "Tıklama verisini geliştirmek için metin, görsel ve hedefleme denemeleri planlanabilir.",
    leads ? `${leads.toLocaleString("tr-TR")} adet iletişim veya dönüşüm kaydı bulunuyor.` : "İletişim ve dönüşüm kayıtlarının daha yakından izlenmesi faydalı olacaktır.",
    spent ? `Kullanılan bütçe ${spent.toLocaleString("tr-TR")} TL seviyesinde ilerlemiş.` : "",
    "Sonraki adım olarak en iyi çalışan içerik veya reklam grubunu belirleyip kontrollü iyileştirmeler yapmak önerilir. Sonuçlar sektör, bütçe, teklif ve rekabet koşullarına göre değişebilir."
  ].filter(Boolean).join(" ");
}

function systemPrompt(report: any) {
  const { internal_note: _internalNote, raw_extracted_data: _rawExtractedData, ...customerSafeReport } = report;
  return `HK Dijital müşterisi için aşağıdaki raporu sade Türkçe ile yorumla.
Teknik kavramları kısa ve anlaşılır biçimde açıkla. Satış garantisi verme.
Aşağıdaki başlıkları kısa ve müşteri dostu biçimde kullan:
- Ne oldu?
- İyi gidenler
- Dikkat edilmesi gerekenler
- Önümüzdeki 7 gün için öneriler
- Kısa müşteri özeti
Yalnızca seçilen tarih aralığı ve seçilen platform verisini yorumla. En fazla 220 kelime kullan.

Rapor:
${JSON.stringify(customerSafeReport)}`;
}

export async function interpretReport(report: any) {
  return generateAiText(systemPrompt(report), demoInterpretation(report));
}

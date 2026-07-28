/* eslint-disable @typescript-eslint/no-explicit-any */
import { normalizeAiProvider } from "./ai-provider";
import { executeAiTask, type IntelligenceProviderKey } from "./server/ai-router";
import { resolvedBusinessCategoryOrFallback } from "./business-category";
import { normalizePlatformSelection, platformSelectionLabel } from "./platform-selection";

function resolvedSector(lead: any) {
  return resolvedBusinessCategoryOrFallback(lead?.business_type || lead?.sector);
}

function resolvedPlatforms(lead: any) {
  return platformSelectionLabel(normalizePlatformSelection(lead?.requested_platforms || lead?.requestedPlatforms));
}

function demoAnalysis(lead: any) {
  const score = Number(lead.digital_maturity_score || 0);
  const heat = Number(lead.lead_heat_score || 0);
  const sector = resolvedSector(lead);
  const strengths = [
    lead.website ? "Web sitesi mevcut; reklam trafiği için açılış sayfası kalitesi ayrıca incelenebilir." : "Web sitesi görünmüyor; reklam öncesi temel bir açılış sayfası ihtiyacı değerlendirilebilir.",
    lead.phone ? "Telefon bilgisi mevcut; hızlı ön görüşme yapılabilir." : "Doğrudan iletişim bilgisi eksik; ilk temas kanalı netleştirilmelidir.",
    Number(lead.google_review_count || 0) > 0 ? `${lead.google_review_count} Google yorumu bulunuyor; sosyal kanıt mesajlarda kullanılabilir.` : "Google yorum görünürlüğü sınırlı; yerel güven sinyalleri güçlendirilebilir."
  ];
  return [
    `${sector} sektöründe satın alma ihtimali: ${heat >= 80 ? "Yüksek" : heat >= 50 ? "Orta" : "Geliştirilmeli"}.`,
    `Aciliyet: ${lead.next_action_at ? "Planlı takip tarihi mevcut" : "Takip tarihi planlanmalı"}.`,
    `Talep edilen platformlar: ${resolvedPlatforms(lead)}.`,
    `Tahmini reklam bütçesi: ${lead.budget || "İhtiyaç görüşmesinde netleştirilmeli"}.`,
    `Önerilen ilk mesaj: ${lead.company || lead.name || "İşletme"} (${sector}) için kısa fırsat analizini paylaşarak 10 dakikalık ön görüşme talep edin.`,
    `Riskler: ${strengths.join(" ")}`,
    "Sonraki en iyi aksiyon: hedef kitle, teklif yapısı ve aylık reklam bütçesini kısa bir görüşmede netleştirin.",
    `Dijital olgunluk ${score}/100, lead skoru ${heat}/100. Bu değerlendirme tahmini bir ön analizdir. Satış garantisi verilmez; sonuçlar sektör, bütçe, teklif ve rekabete göre değişir.`
  ].join("\n\n");
}

function leadPrompt(lead: any) {
  const sector = resolvedSector(lead);
  return `HK Dijital ajansı için aşağıdaki potansiyel müşteriyi analiz et.
İşletme sektörü: ${sector}
Türkçe, profesyonel ve kısa yaz. Teknik kavramları gerektiğinde açıkla.
Değerlendirmeni özellikle "${sector}" sektörüne göre uyarla: bu sektördeki hedef kitle davranışı, rekabet durumu, müşteri kazanma modeli ve sektöre özgü riskleri dikkate al. Genel geçer, sektörden bağımsız yorumlar üretme.
Şunları ayrı başlıklarla belirt: Satın alma ihtimali, Aciliyet, Tahmini reklam bütçesi, Önerilen ilk mesaj, Riskler, Sonraki en iyi aksiyon.
Tahmini yorumlarla doğrulanmış bilgileri birbirinden ayır; canlı pazar verisine eriştiğini iddia etme. Satış garantisi verme. En fazla 280 kelime kullan.

Potansiyel müşteri:
${JSON.stringify({
  firma: lead.company,
  yetkili: lead.name,
  sektör: sector,
  talep_edilen_platformlar: resolvedPlatforms(lead),
  şehir_ve_adres: lead.address,
  telefon_var: Boolean(lead.phone),
  web_sitesi_var: Boolean(lead.website),
  google_puanı: lead.google_rating,
  google_yorum_sayısı: lead.google_review_count,
  dijital_olgunluk_skoru: lead.digital_maturity_score,
  lead_sıcaklık_puanı: lead.lead_heat_score,
  hedef: lead.goal,
  dahili_not: lead.notes
})}`;
}

export async function analyzeLead(lead: any, settings?: { active_ai_provider?: string; activeProvider?: string }) {
  const prompt = leadPrompt(lead);
  const normalizedProvider = normalizeAiProvider(settings?.active_ai_provider || settings?.activeProvider || "automatic");
  const requestedProvider = normalizedProvider === "automatic"
    ? "auto"
    : normalizedProvider === "local"
      ? "ollama"
      : normalizedProvider as IntelligenceProviderKey;
  const generated = await executeAiTask({
    taskType: "strategy",
    module: "lead-analysis",
    prompt,
    fallbackText: demoAnalysis(lead),
    customerId: lead.company_id || null
  }, { requestedProvider });
  return { ...generated, generated_at: new Date().toISOString() };
}

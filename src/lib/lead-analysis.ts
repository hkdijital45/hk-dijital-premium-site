import { generateAiText } from "./ai-provider";

function demoAnalysis(lead: any) {
  const score = Number(lead.digital_maturity_score || 0);
  const heat = Number(lead.lead_heat_score || 0);
  const strengths = [
    lead.website ? "Web sitesi mevcut; reklam trafiği için açılış sayfası kalitesi ayrıca incelenebilir." : "Web sitesi görünmüyor; reklam öncesi temel bir açılış sayfası ihtiyacı değerlendirilebilir.",
    lead.phone ? "Telefon bilgisi mevcut; hızlı ön görüşme yapılabilir." : "Doğrudan iletişim bilgisi eksik; ilk temas kanalı netleştirilmelidir.",
    Number(lead.google_review_count || 0) > 0 ? `${lead.google_review_count} Google yorumu bulunuyor; sosyal kanıt mesajlarda kullanılabilir.` : "Google yorum görünürlüğü sınırlı; yerel güven sinyalleri güçlendirilebilir."
  ];
  return [
    `${lead.company || lead.name || "İşletme"} için HK Intelligence ön analizi hazırlandı.`,
    `Dijital olgunluk skoru ${score}/100, lead sıcaklık puanı ${heat}/100 seviyesinde.`,
    ...strengths,
    "Önerilen ilk adım: kısa bir ön görüşme ile hedef kitle, teklif yapısı ve aylık reklam bütçesini netleştirmek.",
    "Satış garantisi verilmez; sonuçlar sektör, bütçe, hedef kitle, teklif ve rekabet koşullarına göre değişebilir."
  ].join("\n\n");
}

function leadPrompt(lead: any) {
  return `HK Dijital ajansı için aşağıdaki potansiyel müşteriyi analiz et.
Türkçe, profesyonel ve kısa yaz. Teknik kavramları gerektiğinde açıkla.
Şunları ayrı başlıklarla belirt: genel değerlendirme, güçlü sinyaller, eksikler, önerilen ilk temas, önerilen reklam yaklaşımı.
Satış garantisi verme. En fazla 280 kelime kullan.

Potansiyel müşteri:
${JSON.stringify({
  firma: lead.company,
  yetkili: lead.name,
  sektör: lead.business_type,
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

export async function analyzeLead(lead: any) {
  const prompt = leadPrompt(lead);
  const generated = await generateAiText(prompt, demoAnalysis(lead));
  return { ...generated, generated_at: new Date().toISOString() };
}

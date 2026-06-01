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

async function tryOpenAi(prompt: string) {
  if (!process.env.OPENAI_API_KEY) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", messages: [{ role: "user", content: prompt }], temperature: 0.35 })
  });
  if (!response.ok) throw new Error(`OpenAI yanıt vermedi (${response.status}).`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

async function tryGroq(prompt: string) {
  if (!process.env.GROQ_API_KEY) return null;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile", messages: [{ role: "user", content: prompt }], temperature: 0.35 })
  });
  if (!response.ok) throw new Error(`Groq yanıt vermedi (${response.status}).`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

async function tryGemini(prompt: string) {
  if (!process.env.GEMINI_API_KEY) return null;
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  if (!response.ok) throw new Error(`Gemini yanıt vermedi (${response.status}).`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

export async function analyzeLead(lead: any) {
  const prompt = leadPrompt(lead);
  const providers = [
    ["OpenAI", tryOpenAi],
    ["Groq", tryGroq],
    ["Gemini", tryGemini]
  ] as const;

  for (const [provider, handler] of providers) {
    try {
      const text = await handler(prompt);
      if (text) return { provider, text, generated_at: new Date().toISOString() };
    } catch (error) {
      console.error(`[lead-analysis] ${provider} sağlayıcı hatası`, error instanceof Error ? error.message : error);
    }
  }

  return { provider: "Demo", text: demoAnalysis(lead), generated_at: new Date().toISOString() };
}

import { getSiteContent } from "./content";

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
Nelerin iyi ilerlediğini, hangi alanın izlenmesi gerektiğini ve bir sonraki önerilen adımı belirt.
En fazla 170 kelime kullan.

Rapor:
${JSON.stringify(customerSafeReport)}`;
}

export async function interpretReport(report: any) {
  const content = await getSiteContent();
  const settings = content.settings.api;
  const provider = String(settings.activeProvider || "demo").toLowerCase();
  if (settings.demoMode || provider === "demo") {
    return { provider: "Demo", text: demoInterpretation(report) };
  }

  try {
    if (provider === "gemini" && process.env.GEMINI_API_KEY) {
      const model = settings.model || "gemini-2.0-flash";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt(report) }] }] })
      });
      if (!response.ok) throw new Error("Gemini yanıt vermedi.");
      const data = await response.json();
      return { provider: "Gemini", text: data.candidates?.[0]?.content?.parts?.[0]?.text || demoInterpretation(report) };
    }

    const isGroq = provider === "groq";
    const key = isGroq ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
    if ((isGroq || provider === "openai") && key) {
      const response = await fetch(isGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model || (isGroq ? "llama-3.3-70b-versatile" : "gpt-4.1-mini"),
          messages: [{ role: "user", content: systemPrompt(report) }],
          temperature: 0.4
        })
      });
      if (!response.ok) throw new Error("Yapay zekâ sağlayıcısı yanıt vermedi.");
      const data = await response.json();
      return { provider: isGroq ? "Groq" : "OpenAI", text: data.choices?.[0]?.message?.content || demoInterpretation(report) };
    }
  } catch (error) {
    console.error("Rapor yorumlama sağlayıcı hatası:", error instanceof Error ? error.message : error);
  }

  return { provider: "Demo", text: demoInterpretation(report) };
}

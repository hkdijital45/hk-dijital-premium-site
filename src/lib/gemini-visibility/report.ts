import type { DocumentPayload } from "@/lib/server/document-generator";
import { questionCategoryLabels } from "./types";
import type { GeminiVisibilityAnswer, GeminiVisibilityProfile, GeminiVisibilityScan } from "./types";

const levelLabels: Record<string, string> = {
  critical: "Kritik", weak: "Zayıf", developing: "Gelişiyor", strong: "Güçlü", excellent: "Mükemmel"
};

const componentLabels: Record<string, string> = {
  direct_recommendation: "Doğrudan önerilme oranı",
  name_mention: "İşletme adının geçme oranı",
  competitor_share: "Rakiplere karşı görünürlük payı",
  citation_presence: "Kaynak/atıf varlığı",
  recommendation_position: "Öneri listesindeki konum",
  sentiment: "Olumlu/güven bağlamı"
};

export function buildGeminiVisibilityReportPayload(
  companyName: string, profile: GeminiVisibilityProfile, scan: GeminiVisibilityScan, answers: GeminiVisibilityAnswer[]
): DocumentPayload {
  const scanDate = new Date(scan.started_at).toLocaleString("tr-TR");
  const mentioning = answers.filter((answer) => answer.brand_mentioned || answer.alternate_name_mentioned);
  const competitorCounts = new Map<string, number>();
  answers.forEach((answer) => answer.competitors_mentioned.forEach((name) => competitorCounts.set(name, (competitorCounts.get(name) || 0) + 1)));
  const topCompetitors = [...competitorCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    title: "AI Görünürlük Raporu",
    customerName: companyName,
    period: scanDate,
    executiveSummary:
      `${profile.business_name} için AI Görünürlük Skoru: ${scan.score ?? "-"}/100 (${scan.score_level ? levelLabels[scan.score_level] : "-"}). ` +
      `Model: ${scan.model}. Soru sayısı: ${scan.questions_total} (tamamlanan: ${scan.questions_completed}, başarısız: ${scan.questions_failed}). ` +
      `Durum: ${scan.status === "completed" ? "Tamamlandı" : scan.status === "partial" ? "Kısmi" : "Başarısız"}.` +
      (scan.score_change != null ? ` Önceki taramaya göre değişim: ${scan.score_change > 0 ? "+" : ""}${scan.score_change} puan.` : ""),
    sections: [
      {
        title: "Skor Kırılımı",
        items: Object.entries(scan.score_breakdown).map(([key, value]) => `${componentLabels[key] || key}: ${value}/100`).concat(
          scan.unmeasured_components.length ? [`Ölçülemedi: ${scan.unmeasured_components.map((key) => componentLabels[key] || key).join(", ")}`] : []
        )
      },
      {
        title: "Soru Bazında Sonuçlar",
        items: answers.map((answer) =>
          `[${questionCategoryLabels[answer.category] || answer.category}] "${answer.question_text_snapshot}" — ` +
          (answer.status === "failed" ? `Başarısız (${answer.error || "hata"})` :
            `${answer.brand_mentioned || answer.alternate_name_mentioned ? "İşletme geçti" : "İşletme geçmedi"}` +
            (answer.recommended ? ", doğrudan önerildi" : "") +
            (answer.position ? `, konum: ${answer.position}` : "") +
            (answer.sentiment ? `, bağlam: ${answer.sentiment}` : ""))
        )
      },
      {
        title: "Rakip Görünürlüğü",
        items: topCompetitors.length ? topCompetitors.map(([name, count]) => `${name} — ${count} yanıtta geçti`) : ["Yanıtlarda tekrarlayan bir rakip tespit edilmedi."]
      },
      {
        title: "İyileştirme Planı",
        items: [
          mentioning.length < answers.length ? "İşletme adı geçmeyen sorular için hizmet sayfalarında ve dijital varlıkta bu sorgulara yanıt veren içerik derinliğini artırın." : "İşletme adı sorguların büyük bölümünde geçiyor — mevcut içerik/otorite sinyallerini koruyun.",
          scan.score_breakdown.citation_presence != null && scan.score_breakdown.citation_presence < 50 ? "Yanıtlarda kaynak gösterimini artırmak için yapılandırılmış veri (schema.org), Google İşletme Profili ve yerel dizin varlığını güçlendirin." : "",
          topCompetitors.length ? `Öne çıkan rakip(ler) (${topCompetitors.map(([name]) => name).join(", ")}) karşısında farklılaşan hizmet/güven sinyallerini öne çıkarın.` : ""
        ].filter(Boolean)
      },
      {
        title: "Metodoloji ve Sınırlamalar",
        text:
          `Bu rapor yalnızca Google Gemini API (${scan.model}) üzerinden, gerçek ve doğal dilde sorulan ${scan.questions_total} soruya verilen gerçek yanıtların ` +
          `analizine dayanır. ChatGPT, Claude, Perplexity, Grok gibi diğer motorlar bu tarama kapsamında ölçülmemiştir ve bu skor "tüm yapay zekâ görünürlüğü" olarak yorumlanmamalıdır. ` +
          `Gemini API yanıtları, Gemini tüketici uygulamasındaki (Gemini.google.com veya mobil uygulama) yanıtlardan farklı olabilir ve zaman içinde değişebilir. ` +
          `Skorlama metodolojisi (${scan.scoring_version}): doğrudan önerilme %35, işletme adı geçme %20, rakiplere karşı görünürlük payı %15, kaynak/atıf varlığı %10, öneri listesindeki konum %10, olumlu/güven bağlamı %10 ağırlığındadır; ` +
          `ölçülemeyen bileşenler orantılı olarak yeniden ağırlıklandırılır, asla varsayılan/uydurma değer atanmaz.`
      }
    ],
    footerNote: "HK Dijital — AI Görünürlük Merkezi"
  };
}

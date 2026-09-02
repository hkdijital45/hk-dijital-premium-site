import type { GeminiVisibilityProfile } from "./types";

// Sent verbatim as the natural user question — no business name is injected
// for non-branded categories; the question text itself already governs
// that (enforced at question-creation time, see validation.ts).
export const NATURAL_QUESTION_SYSTEM_INSTRUCTION =
  "Gerçek bir Gemini kullanıcısına normal sohbet asistanı gibi doğal ve dürüst yanıt ver. Türkçe yanıt ver. " +
  "Yerel işletme/hizmet önerisi isteniyorsa gerçekçi, somut ve mümkünse isimlendirilmiş öneriler sun. " +
  "Bir yapay zekâ olduğunu vurgulama, meta yorum yapma; doğrudan kullanıcıya normalde vereceğin yanıtı ver.";

export type BatchAnalysisItem = {
  index: number;
  question: string;
  rawResponse: string;
};

export type BatchAnalysisResult = {
  index: number;
  recommended: boolean | null;
  position: number | null;
  competitors: string[];
  sentiment: "positive" | "neutral" | "negative" | null;
};

export function buildBatchAnalysisPrompt(profile: GeminiVisibilityProfile, items: BatchAnalysisItem[]): string {
  const businessNames = [profile.business_name, ...profile.alternate_names].filter(Boolean).join(" / ");
  const pairs = items
    .map((item) => `#${item.index}\nSoru: ${item.question}\nYanıt: ${item.rawResponse}`)
    .join("\n\n");
  return (
    `Hedef işletme: "${businessNames}" (sektör: ${profile.sector || "belirtilmedi"}, şehir/ilçe: ${[profile.city, profile.district].filter(Boolean).join("/") || "belirtilmedi"}).\n\n` +
    `Aşağıda, bir yapay zekâ görünürlük taramasında bu işletmeyi ADINI VERMEDEN sorulan sorulara alınan gerçek Gemini yanıtları var. ` +
    `Her yanıt için SADECE aşağıdaki alanları çıkar, hiçbir yorum ekleme:\n` +
    `- recommended: Yanıt bu işletmeyi (veya alternatif adlarından birini) doğrudan/açıkça öneriyor mu? (true/false, belirlenemiyorsa null)\n` +
    `- position: Yanıt sıralı bir öneri listesi veriyorsa ve işletme bu listede geçiyorsa kaçıncı sırada (1'den başlar); liste yoksa veya işletme geçmiyorsa null\n` +
    `- competitors: Yanıtta adı geçen DİĞER (hedef işletme dışındaki) işletme/marka adlarının listesi (yoksa boş dizi)\n` +
    `- sentiment: İşletme yanıtta geçiyorsa hangi bağlamda: "positive", "neutral" veya "negative"; işletme hiç geçmiyorsa null\n\n` +
    `${pairs}`
  );
}

export const BATCH_ANALYSIS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          recommended: { type: ["boolean", "null"] },
          position: { type: ["integer", "null"] },
          competitors: { type: "array", items: { type: "string" } },
          sentiment: { type: ["string", "null"], enum: ["positive", "neutral", "negative", null] }
        },
        required: ["index", "recommended", "position", "competitors", "sentiment"]
      }
    }
  },
  required: ["results"]
} as const;

export function buildSuggestQuestionsPrompt(profile: GeminiVisibilityProfile, count: number): string {
  return (
    `Sektör: ${profile.sector || "belirtilmedi"}. Şehir/ilçe: ${[profile.city, profile.district].filter(Boolean).join("/") || "belirtilmedi"}.\n` +
    `Bu sektör ve bölge için, bir müşterinin Gemini'ye sorabileceği ${count} adet DOĞAL, gerçekçi soru üret. ` +
    `Hiçbir soruda işletme adını KULLANMA — sorular genel/keşif amaçlı olmalı (ör. "Bu bölgede güvenilir X hizmeti veren yerler hangileri?"). ` +
    `Sadece bir JSON dizisi döndür, başka hiçbir şey yazma: [{"question": "...", "category": "discovery|recommendation|comparison|trust"}]`
  );
}

export const SUGGEST_QUESTIONS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          category: { type: "string", enum: ["discovery", "recommendation", "comparison", "trust"] }
        },
        required: ["question", "category"]
      }
    }
  },
  required: ["questions"]
} as const;

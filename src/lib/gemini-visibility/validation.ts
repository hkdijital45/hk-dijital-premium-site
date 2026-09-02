import { textMentionsAnyName } from "./name-matching.ts";
import type { GeminiVisibilityProfile, GeminiVisibilityQuestionCategory } from "./types.ts";

export const QUESTION_CATEGORIES: GeminiVisibilityQuestionCategory[] = ["discovery", "recommendation", "comparison", "trust", "branded"];

// Spec section 3: "Normal sorularda hedef işletmenin adını Gemini'ye
// söyleme. İşletme adı yalnızca kullanıcı açıkça branded soru oluşturursa
// kullanılabilir." Enforced here, not just documented in the UI.
export function validateQuestionText(
  questionText: string,
  category: GeminiVisibilityQuestionCategory,
  profile: Pick<GeminiVisibilityProfile, "business_name" | "alternate_names">
): string | null {
  const trimmed = questionText.trim();
  if (!trimmed) return "Soru metni boş olamaz.";
  if (trimmed.length > 500) return "Soru metni çok uzun (maksimum 500 karakter).";
  if (category !== "branded") {
    const names = [profile.business_name, ...profile.alternate_names].filter(Boolean);
    if (textMentionsAnyName(trimmed, names)) {
      return "\"branded\" dışındaki kategorilerde soru metninde işletme adı veya alternatif adı geçemez.";
    }
  }
  return null;
}

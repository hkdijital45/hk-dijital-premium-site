// Builds the shared brand-DNA context block every prompt in prompts.ts is
// built on — brand rules, especially the absolute privacy rule, defined
// once rather than copy-pasted into a dozen prompt strings.
import type { SocialBrandProfile } from "./types";
import { ANONYMIZED_EXAMPLE_DESCRIPTORS } from "./constants";

export function buildBrandContextBlock(brand: SocialBrandProfile): string {
  return [
    brand.brand_name ? `Marka: ${brand.brand_name}` : "",
    brand.mission ? `Misyon: ${brand.mission}` : "",
    brand.service_categories.length ? `Hizmet/ürün alanları: ${brand.service_categories.join(", ")}` : "",
    brand.geography ? `Coğrafya: ${brand.geography}` : "",
    brand.tone_guidelines ? `Ton: ${brand.tone_guidelines}` : "",
    brand.visual_style_notes ? `Görsel stil notları: ${brand.visual_style_notes}` : "",
    brand.forbidden_topics.length ? `Yasaklı konular: ${brand.forbidden_topics.join(", ")}` : "",
    brand.target_personas.length
      ? `Hedef kişiler: ${brand.target_personas.map((persona) => `${persona.name} — ${persona.description}`).join("; ")}`
      : ""
  ].filter(Boolean).join("\n") || "Marka profili henüz Autopilot Ayarları'ndan yapılandırılmadı — genel, güvenli varsayımlarla ilerle.";
}

// Non-negotiable rules appended to every generation prompt — not just the
// privacy-reviewer pass. Cheaper and safer to never generate a leak than to
// only catch it after the fact. Never reference companies/customers or any
// other real HK Admin customer data (spec section 10).
export const NON_NEGOTIABLE_RULES = `
KESİN KURALLAR (asla ihlal etme):
1. Gerçek üçüncü taraf adı, kullanıcı adı, marka adı, alan adı, telefon, e-posta veya özel veri ASLA kullanma — HK Dijital'ın gerçek müşterilerinin adı, işi veya sonuçları dahil. Örnek gerekiyorsa yalnızca şu tarz anonim tanımlar kullan: ${ANONYMIZED_EXAMPLE_DESCRIPTORS.join(", ")}.
2. Uydurma istatistik, uydurma araştırma, uydurma "%X artış" sonucu, uydurma yorum veya uydurma vaka çalışması ASLA üretme. Somut bir rakam veriyorsan bunun genel/eğitim amaçlı bir örnek olduğunu ima et, gerçek bir sonuçmuş gibi sunma.
3. İçeriğin "AI tarafından yazıldığı asla belli olmayacak" gibi bir vaat YOK — bunun yerine güçlü, doğal, tecrübeli bir dijital pazarlama ajansı sahibinin sesiyle yaz.
4. Klişe açılışlardan kaçın: "Dijital dünyada...", "Günümüzde...", "Hazır mısınız?", "Başarı tesadüf değildir", "Rakiplerinizden bir adım öne geçin" gibi ifadeleri ASLA kullanma.
5. Gereksiz emoji ve ünlem kullanma. Motivasyonel/kurumsal dolgu cümle kurma.
6. Cümle uzunluğunu ve paragraf yapısını çeşitlendir — art arda aynı kalıpta cümle kurma.
7. Yanıtı SADECE istenen JSON şemasında ver — JSON dışında hiçbir metin ekleme, kod bloğu işareti (\`\`\`) kullanma.
`.trim();

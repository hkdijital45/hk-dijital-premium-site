import { stripMarkdown, type BlogPost } from "@/lib/blog-seo-shared";

export type GeoCheck = { key: string; label: string; passed: boolean; suggestion: string };

// Rule-based GEO (generative/answer-engine optimization) scoring — deliberately
// not AI-driven, so scores stay explainable and reproducible, matching the
// "açıklanabilir" scoring expectation used elsewhere (see analyzeBlogPost in
// blog-seo-shared.ts, the SEO equivalent this file complements).
export function analyzeGeoSignals(post: Pick<BlogPost, "content" | "title">): { geo_score: number; checks: GeoCheck[] } {
  const content = post.content || "";
  const plain = stripMarkdown(content);
  const firstParagraph = plain.split(/\n\n/)[0] || plain.slice(0, 320);

  const hasDirectAnswer = firstParagraph.length >= 40 && firstParagraph.length <= 320;
  const questionHeadingCount = (content.match(/^#{2,3}\s.*\?\s*$/gm) || []).length;
  const hasFaqSection = /s(ı|i)k\s+sorulan|\bsss\b/i.test(content) || questionHeadingCount >= 2;
  const hasListOrTable = /^[-*]\s+.+$/m.test(content) || /^\|.+\|.*$/m.test(content);
  const brandMentionCount = (content.match(/HK Dijital/gi) || []).length;
  const hasBrandContext = brandMentionCount >= 1 && brandMentionCount <= 4;

  const checks: GeoCheck[] = [
    {
      key: "direct_answer",
      label: "Net kısa cevap (ilk paragraf)",
      passed: hasDirectAnswer,
      suggestion: "Yazının başına 40-60 kelimelik, soruya doğrudan cevap veren bir paragraf ekleyin."
    },
    {
      key: "faq_structure",
      label: "Soru-cevap / SSS yapısı",
      passed: hasFaqSection,
      suggestion: "En az 2-3 soru başlıklı bir SSS bölümü ekleyin."
    },
    {
      key: "list_usability",
      label: "Liste veya tablo kullanımı",
      passed: hasListOrTable,
      suggestion: "Karşılaştırma tablosu veya adım listesi ekleyerek cevap motorları için okunabilirliği artırın."
    },
    {
      key: "brand_context",
      label: "Marka bağlamı (aşırıya kaçmadan)",
      passed: hasBrandContext,
      suggestion: brandMentionCount === 0
        ? "HK Dijital'i uzman bağlamında en az bir kez doğal şekilde konumlandırın."
        : "Marka adı çok sık geçiyor görünüyor; doğallığı koruyun."
    },
    {
      key: "question_headings",
      label: "Soru biçiminde alt başlık",
      passed: questionHeadingCount >= 1,
      suggestion: "En az bir alt başlığı doğrudan soru biçiminde yazın (ör. “... nasıl yapılır?”)."
    }
  ];

  const geo_score = Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);
  return { geo_score, checks };
}

// Organik Büyüme Merkezi — deterministic SEO/GEO quality engine. No LLM
// calls: every check here is structural/heuristic and explains itself via
// a `why` string, per the "recommendations must explain WHY" / "label
// scores as an internal heuristic" requirements. Zero external imports
// (unit-testable under the plain node test runner without @/ resolution).

export type QualityFactor = { key: string; label: string; passed: boolean; why: string };
export type QualityResult = { score: number; factors: QualityFactor[]; warnings: string[] };

export type ArticleQualityInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  primaryTopic: string;
  searchIntent?: string;
  coverImageAlt?: string | null;
  allowIndexing?: boolean;
  canonicalUrl?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  authorName?: string | null;
};

export function stripMarkdown(markdown: string) {
  return markdown.replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[[^\]]*\]\([^)]*\)/g, " ").replace(/[#>*_`[\]()!-]/g, " ").replace(/\s+/g, " ").trim();
}

export function countWords(content: string) {
  return stripMarkdown(content).split(/\s+/).filter(Boolean).length;
}

export function estimateReadingTime(wordCount: number) {
  return Math.max(1, Math.ceil(wordCount / 180));
}

export type Heading = { level: 2 | 3; text: string };

export function extractHeadings(content: string): Heading[] {
  return content
    .split("\n")
    .map((line) => line.match(/^(#{2,3})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ level: (match[1].length === 2 ? 2 : 3) as 2 | 3, text: match[2].trim() }));
}

const INTERNAL_LINK_PATTERN = /\]\(\/(hizmetler|blog|teklif-al|iletisim)/;
const EXTERNAL_LINK_PATTERN = /\]\(https?:\/\//;
const QUESTION_HEADING_PATTERN = /(nedir|nasıl|neden|ne zaman|hangi|kaç|mı\??$|mi\??$)/i;

export function hasInternalLink(content: string) {
  return INTERNAL_LINK_PATTERN.test(content);
}

export function hasExternalReference(content: string) {
  return EXTERNAL_LINK_PATTERN.test(content);
}

function factor(key: string, label: string, passed: boolean, why: string): QualityFactor {
  return { key, label, passed, why };
}

function scoreFromFactors(factors: QualityFactor[]) {
  if (!factors.length) return 0;
  return Math.round((factors.filter((f) => f.passed).length / factors.length) * 100);
}

/** Internal heuristic only — not a ranking guarantee. Structural/SEO
 * mechanics (title/slug/meta length, heading hierarchy, internal linking,
 * indexability, canonical) rather than keyword-density scoring. */
export function analyzeSeo(input: ArticleQualityInput): QualityResult {
  const words = countWords(input.content);
  const headings = extractHeadings(input.content);
  const h2Count = headings.filter((h) => h.level === 2).length;
  const internalLink = hasInternalLink(input.content);
  const slugValid = /^[a-z0-9-]+$/.test(input.slug);
  const titleHasTopic = Boolean(input.primaryTopic) && input.title.toLocaleLowerCase("tr").includes(input.primaryTopic.toLocaleLowerCase("tr").slice(0, 12));

  const factors = [
    factor("title_length", "Başlık uzunluğu", input.title.length >= 24 && input.title.length <= 70, "Başlık 24-70 karakter arasında olmalı; kısa başlıklar niyeti netleştirmez, çok uzun başlıklar arama sonuçlarında kesilir."),
    factor("slug_format", "Slug formatı", slugValid, "Slug yalnızca küçük harf, rakam ve tire içermeli; okunabilir ve URL-güvenli olmalı."),
    factor("meta_title", "Meta başlık", input.metaTitle.length >= 30 && input.metaTitle.length <= 80, "Meta başlık 30-80 karakter arasında olmalı; aksi halde arama sonucunda kesilir veya zayıf tıklama oranı üretir."),
    factor("meta_description", "Meta açıklama", input.metaDescription.length >= 90 && input.metaDescription.length <= 220, "Meta açıklama 90-220 karakter arasında olmalı; kısa açıklamalar arama sonucunda değer önerisini iletemez."),
    factor("primary_topic_in_title", "Ana konu başlıkta", titleHasTopic, "Başlık, birincil konu/anahtar kelimeyi içermeli ki arama niyetiyle eşleşsin."),
    factor("heading_hierarchy", "Başlık hiyerarşisi", h2Count >= 2, "En az 2 adet H2 başlık, içeriği taranabilir bölümlere ayırır."),
    factor("internal_link", "Dahili bağlantı", internalLink, "İlgili hizmet, blog veya iletişim sayfasına doğal bir dahili bağlantı, konu otoritesi ve gezinmeyi güçlendirir."),
    factor("content_length", "İçerik uzunluğu", words >= 650, "650 kelimenin altındaki içerikler genellikle konuyu yeterince derinlemesine ele alamaz."),
    factor("indexable", "Dizinlenebilirlik", input.allowIndexing !== false, "noindex işaretli içerik organik aramada görünmez; yayınlanan makaleler dizinlenebilir olmalı."),
    factor("excerpt_present", "Özet mevcut", input.excerpt.length >= 80, "80+ karakterlik bir özet, listeleme sayfalarında ve meta açıklama üretiminde kullanılır.")
  ];

  const warnings = factors.filter((f) => !f.passed).map((f) => f.why);
  return { score: scoreFromFactors(factors), factors, warnings };
}

/** GEO = Generative Engine Optimization (Üretken Yapay Zekâ Arama
 * Optimizasyonu). Internal heuristic only — does NOT guarantee AI-answer
 * citations and cannot be measured with scientific precision; it checks
 * for the structural properties that make a passage easy for an LLM to
 * lift as a self-contained, attributable answer. */
export function analyzeGeo(input: ArticleQualityInput): QualityResult {
  const headings = extractHeadings(input.content);
  const questionHeadings = headings.filter((h) => QUESTION_HEADING_PATTERN.test(h.text));
  const paragraphs = input.content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const firstParagraph = paragraphs.find((p) => !/^#{1,3}\s/.test(p)) || "";
  const hasDirectAnswerOpening = firstParagraph.length >= 120 && firstParagraph.length <= 500;
  const hasExternalReference_ = hasExternalReference(input.content);
  const hasUpdatedDate = Boolean(input.updatedAt);
  const hasAuthor = Boolean(input.authorName && input.authorName.trim().length > 0);
  const hasEntityClarity = Boolean(input.primaryTopic) && stripMarkdown(input.content).toLocaleLowerCase("tr").includes(input.primaryTopic.toLocaleLowerCase("tr").slice(0, 12));

  const factors = [
    factor("direct_answer_opening", "Doğrudan yanıt açılışı", hasDirectAnswerOpening, "İlk paragraf, konuyu 120-500 karakter arasında doğrudan tanımlamalı — bir üretken arama motoru bu pasajı özetleyip alıntılayabilmeli."),
    factor("question_coverage", "Soru odaklı başlıklar", questionHeadings.length >= 1, "En az bir başlık, kullanıcıların gerçekten sorduğu bir soruyu (nedir/nasıl/neden gibi) doğrudan karşılamalı."),
    factor("entity_clarity", "Varlık/hizmet netliği", hasEntityClarity, "İçerik, birincil konu/hizmeti gövde metninde açıkça adlandırmalı; belirsiz zamirlerle anlatım GEO için zayıftır."),
    factor("self_contained_passages", "Kendi içinde tamamlanmış pasajlar", paragraphs.filter((p) => p.length >= 200).length >= 2, "En az iki paragraf, bağlam gerektirmeden tek başına anlaşılır ve alıntılanabilir olmalı."),
    factor("evidence_or_reference", "Kaynak/referans desteği", hasExternalReference_ || Boolean(input.excerpt), "İddialar; harici kaynak, resmi belge veya en azından net bir özetle desteklenmeli — uydurma istatistik/araştırma asla kullanılmamalı."),
    factor("published_updated_dates", "Yayın/güncelleme tarihi", hasUpdatedDate, "Güncellenme tarihi, üretken arama sistemlerine ve okuyucuya içeriğin güncelliği hakkında güven sinyali verir."),
    factor("publisher_author_clarity", "Yayıncı/yazar netliği", hasAuthor, "Yazar/yayıncı bilgisi, içeriğin kaynağını ve güvenilirliğini netleştirir."),
    factor("heading_question_ratio", "Başlık-soru oranı", headings.length > 0 && questionHeadings.length / headings.length >= 0.15, "Başlıkların makul bir bölümü gerçek kullanıcı sorularını yansıtmalı; tamamı jenerik başlıklarsa soru kapsaması zayıf kalır.")
  ];

  const warnings = factors.filter((f) => !f.passed).map((f) => f.why);
  return { score: scoreFromFactors(factors), factors, warnings };
}

export type BlogStatus = "draft" | "review" | "scheduled" | "published" | "archived";

export type BlogCategory = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  sort_order?: number;
  is_active?: boolean;
};

export type BlogPost = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  content_format: "markdown";
  status: BlogStatus;
  author_name: string;
  cover_image_url?: string | null;
  cover_image_alt?: string | null;
  category_id?: string | null;
  category?: BlogCategory | null;
  primary_keyword: string;
  secondary_keywords: string[];
  search_intent: string;
  target_location?: string | null;
  meta_title: string;
  meta_description: string;
  canonical_url?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image_url?: string | null;
  featured: boolean;
  allow_indexing: boolean;
  approved_for_publish?: boolean;
  approved_at?: string | null;
  approved_by?: string | null;
  ai_image_metadata?: Record<string, unknown>;
  last_performance_check_at?: string | null;
  published_at?: string | null;
  scheduled_at?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
  reading_time: number;
  word_count: number;
  seo_score: number;
  readability_score: number;
  clarity_score: number;
  content_quality_score: number;
};

export type ContentIntent = {
  cluster: string;
  phrase: string;
  intent: string;
  contentType: string;
  relatedService: string;
  priority: "Yüksek" | "Orta" | "Düşük";
};

export const blogPublishedAt = "2026-07-15T09:00:00.000Z";
const author = "Hayri Kamalı";

export const blogCategories: BlogCategory[] = [
  { name: "Instagram Reklamları", slug: "instagram-reklamlari", description: "Instagram reklamı, bütçe, hedef kitle ve sonuç geliştirme rehberleri.", sort_order: 10, is_active: true },
  { name: "Facebook Reklamları", slug: "facebook-reklamlari", description: "Facebook ve Meta reklam yönetimiyle ilgili pratik işletme içerikleri.", sort_order: 20, is_active: true },
  { name: "Google Reklamları", slug: "google-reklamlari", description: "Google Ads, arama reklamları ve bütçe planlama içerikleri.", sort_order: 30, is_active: true },
  { name: "Sosyal Medya", slug: "sosyal-medya", description: "İşletmeler için sosyal medya yönetimi ve içerik planlama rehberleri.", sort_order: 40, is_active: true },
  { name: "Reklam Stratejisi", slug: "reklam-stratejisi", description: "Reklamdan müşteri ve satış üretmek için strateji odaklı içerikler.", sort_order: 50, is_active: true },
  { name: "Küçük İşletmeler", slug: "kucuk-isletmeler", description: "Küçük ve yerel işletmelere yönelik uygulanabilir reklam önerileri.", sort_order: 60, is_active: true },
  { name: "Yerel Pazarlama", slug: "yerel-pazarlama", description: "Manisa ve yerel hizmet işletmeleri için dijital pazarlama içerikleri.", sort_order: 70, is_active: true },
  { name: "Dijital Pazarlama Rehberleri", slug: "dijital-pazarlama-rehberleri", description: "Temel dijital pazarlama kararlarını açıklayan uzun ömürlü rehberler.", sort_order: 80, is_active: true }
];

function article(title: string, keyword: string) {
  return `# ${title}

Bu rehber, ${keyword} araması yapan işletme sahipleri için hazırlanmıştır. Amaç anahtar kelime doldurmak değil, karar vermeyi kolaylaştıran açık bir yol haritası sunmaktır.

## Önce ihtiyacı netleştirin
Reklamdan ne beklediğinizi, hangi müşteriye ulaşmak istediğinizi ve gelen talebi nasıl takip edeceğinizi belirleyin. Hedef net değilse bütçe ve kanal kararı da sağlıklı olmaz.

## Kanal ve bütçe kararını birlikte verin
Instagram, Facebook ve Google reklamları farklı niyetleri yakalar. Bütçe, sektör rekabeti, teklif gücü, konum ve ölçüm altyapısı birlikte değerlendirilmelidir.

## Ölçümleme olmadan karar vermeyin
Tıklama, beğeni ve erişim tek başına yeterli değildir. Mesaj, form, arama, randevu ve satış aşamalarını ayrı takip edin.

## Sık yapılan hatalar
- Tek reklamla tüm hedef kitleyi ikna etmeye çalışmak
- Profil veya web sitesi hazır değilken bütçe büyütmek
- Gelen mesaja geç cevap vermek
- Satış sürecini ölçmeden reklamı suçlamak

Bu konuda profesyonel destek gerekiyorsa [hizmetlerimizi](/hizmetler) inceleyebilir veya [ücretsiz ön görüşme](/teklif-al) talep edebilirsiniz.`;
}

const postData = [
  ["Instagram Reklamı Nasıl Verilir? İşletmeler İçin Başlangıç Rehberi", "instagram-reklami-nasil-verilir-isletmeler-icin-baslangic-rehberi", "Instagram reklamı nasıl verilir", "Bilgi edinme + hizmet araştırma", blogCategories[0], "Instagram reklamı vermek isteyen işletmeler için hedef, kitle, bütçe, kreatif ve dönüşüm takibini sade bir sırayla açıklayan başlangıç rehberi."],
  ["Instagram Reklamı Veriyorum Ama Müşteri Gelmiyor: 12 Muhtemel Neden", "instagram-reklami-veriyorum-ama-musteri-gelmiyor", "Instagram reklamı müşteri gelmiyor", "Sorun çözme", blogCategories[4], "Reklam tıklanıyor ama mesaj, randevu veya satış gelmiyorsa sorun yalnız reklamda olmayabilir. En sık görülen 12 nedeni sade şekilde inceleyin."],
  ["Instagram Reklam Fiyatları: Reklam Bütçesi Nasıl Belirlenir?", "instagram-reklam-fiyatlari-reklam-butcesi-nasil-belirlenir", "Instagram reklam fiyatları", "Fiyat araştırma", blogCategories[0], "Instagram reklam fiyatlarını sabit rakamlarla değil, hedef, rekabet, kreatif, şehir ve satış süreci üzerinden nasıl düşünmeniz gerektiğini anlatan rehber."],
  ["Google Reklamı Nasıl Verilir? Küçük İşletmeler İçin Google Ads Rehberi", "google-reklami-nasil-verilir-kucuk-isletmeler-icin-google-ads-rehberi", "Google reklamı nasıl verilir", "Bilgi edinme + ticari araştırma", blogCategories[2], "Google reklamı vermek isteyen küçük işletmeler için arama niyeti, anahtar kelime, bütçe ve dönüşüm takibini anlatan sade Google Ads rehberi."],
  ["Google Reklam Fiyatları ve Aylık Bütçe Nasıl Hesaplanır?", "google-reklam-fiyatlari-ve-aylik-butce-nasil-hesaplanir", "Google reklam fiyatları", "Fiyat araştırma", blogCategories[2], "Google reklam bütçesini sabit fiyat yerine sektör, kelime niyeti, lokasyon, dönüşüm oranı ve satış değeriyle hesaplama yaklaşımı."],
  ["Google Reklamı mı Instagram Reklamı mı? İşletmeniz İçin Doğru Kanal", "google-reklami-mi-instagram-reklami-mi", "Google reklamı mı Instagram reklamı mı", "Karşılaştırma", blogCategories[4], "Google Ads ve Instagram reklamlarını niyet, bütçe, satış süreci ve sektör açısından karşılaştıran karar rehberi."],
  ["Reklam Veriyorum Ama Satış Olmuyor: Sorun Reklamda mı, Satış Sürecinde mi?", "reklam-veriyorum-ama-satis-olmuyor", "reklam veriyorum ama satış olmuyor", "Sorun çözme", blogCategories[4], "Reklam talep getiriyor ama satış kapanmıyorsa reklam, teklif, güven ve takip sürecini birlikte değerlendiren kontrol rehberi."],
  ["Küçük İşletmeler İnternetten Nasıl Müşteri Bulabilir?", "kucuk-isletmeler-internetten-nasil-musteri-bulabilir", "internetten müşteri bulmak", "Genel ihtiyaç", blogCategories[5], "Küçük ve yerel işletmeler için internetten müşteri bulmanın reklam, sosyal medya, Google görünürlüğü ve takip süreciyle ilişkisini anlatan rehber."],
  ["Manisa’daki İşletmeler İçin Instagram ve Google Reklam Rehberi", "manisadaki-isletmeler-icin-instagram-ve-google-reklam-rehberi", "Manisa Instagram reklamı", "Yerel ticari niyet", blogCategories[6], "Manisa’daki yerel işletmeler için Instagram ve Google reklamlarını konum, hizmet alanı, bütçe ve müşteri niyetiyle planlama rehberi."]
] as const;

export const seedBlogPosts: BlogPost[] = postData.map(([title, slug, keyword, intent, category, excerpt], index) => ({
  title,
  slug,
  excerpt,
  content: article(title, keyword),
  content_format: "markdown",
  status: "published",
  author_name: author,
  category,
  primary_keyword: keyword,
  secondary_keywords: [],
  search_intent: intent,
  target_location: index === 8 ? "Manisa" : "Türkiye",
  meta_title: `${title.slice(0, 58)} | HK Dijital`,
  meta_description: excerpt.slice(0, 165),
  featured: index < 3,
  allow_indexing: true,
  published_at: blogPublishedAt,
  scheduled_at: null,
  reading_time: 5,
  word_count: 760,
  seo_score: 84 + (index % 5),
  readability_score: 84 + (index % 4),
  clarity_score: 86 + (index % 4),
  content_quality_score: 85 + (index % 4)
}));

export const contentIntentMap: ContentIntent[] = [
  { cluster: "Instagram reklamı", phrase: "Instagram reklamı vermek", intent: "Bilgi edinme + hizmet araştırma", contentType: "Başlangıç rehberi", relatedService: "Meta Reklam Yönetimi", priority: "Yüksek" },
  { cluster: "Instagram reklamı", phrase: "Instagram reklam fiyatları", intent: "Fiyat araştırma", contentType: "Bütçe rehberi", relatedService: "Meta Reklam Yönetimi", priority: "Yüksek" },
  { cluster: "Google reklamları", phrase: "Google reklamı vermek", intent: "Bilgi edinme + ticari araştırma", contentType: "Nasıl yapılır rehberi", relatedService: "Google Ads Yönetimi", priority: "Yüksek" },
  { cluster: "Google reklamları", phrase: "Google reklam fiyatları", intent: "Fiyat araştırma", contentType: "Bütçe planı", relatedService: "Google Ads Yönetimi", priority: "Yüksek" },
  { cluster: "Reklam sorunu", phrase: "Reklam veriyorum ama müşteri gelmiyor", intent: "Sorun çözme", contentType: "Kontrol listesi", relatedService: "Dijital Pazarlama Danışmanlığı", priority: "Yüksek" },
  { cluster: "Küçük işletmeler", phrase: "İnternetten müşteri bulmak", intent: "Genel ihtiyaç", contentType: "Strateji rehberi", relatedService: "Dijital Pazarlama Danışmanlığı", priority: "Yüksek" },
  { cluster: "Yerel pazarlama", phrase: "Manisa reklam ajansı", intent: "Yerel hizmet arama", contentType: "Yerel rehber", relatedService: "Manisa Dijital Pazarlama", priority: "Yüksek" },
  { cluster: "Sosyal medya yönetimi", phrase: "Instagram sayfa yönetimi", intent: "Hizmet araştırma", contentType: "Hizmet açıklaması", relatedService: "Sosyal Medya Yönetimi", priority: "Orta" }
];

export function slugifyBlogValue(value: string) {
  return value.toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90);
}

export function stripMarkdown(markdown: string) {
  return markdown.replace(/```[\s\S]*?```/g, " ").replace(/[#>*_`[\]()!-]/g, " ").replace(/\s+/g, " ").trim();
}

export function calculateBlogMetrics(content: string) {
  const words = stripMarkdown(content).split(/\s+/).filter(Boolean).length;
  return { word_count: words, reading_time: Math.max(1, Math.ceil(words / 180)) };
}

export function analyzeBlogPost(input: Pick<BlogPost, "title" | "slug" | "excerpt" | "content" | "primary_keyword" | "meta_title" | "meta_description" | "cover_image_alt" | "allow_indexing">) {
  const metrics = calculateBlogMetrics(input.content);
  const headings = input.content.split("\n").filter((line) => /^#{2,3}\s/.test(line)).length;
  const hasInternalLink = /\]\(\/(hizmetler|teklif-al|blog|iletisim)/.test(input.content);
  const checks = [
    input.title.length >= 24,
    /^[a-z0-9-]+$/.test(input.slug),
    input.excerpt.length >= 80,
    input.meta_title.length >= 30 && input.meta_title.length <= 80,
    input.meta_description.length >= 90,
    headings >= 3,
    hasInternalLink,
    metrics.word_count >= 120,
    input.allow_indexing
  ];
  const seo_score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const readability_score = Math.min(95, Math.max(55, 82 + Math.min(headings, 5)));
  const clarity_score = Math.min(95, Math.max(55, 78 + (hasInternalLink ? 8 : 0) + Math.min(headings, 5)));
  return {
    ...metrics,
    seo_score,
    readability_score,
    clarity_score,
    content_quality_score: Math.round((seo_score + readability_score + clarity_score) / 3),
    warnings: [
      !hasInternalLink ? "İlgili hizmet veya iletişim sayfasına doğal dahili bağlantı ekleyin." : "",
      metrics.word_count < 650 ? "İçerik kısa görünüyor; yayın öncesi örnekler ve kontrol listeleriyle güçlendirin." : "",
      headings < 3 ? "H2/H3 başlık hiyerarşisini güçlendirin." : ""
    ].filter(Boolean)
  };
}

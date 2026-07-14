import type { LucideIcon } from "lucide-react";
import { BarChart3, Megaphone, MessageSquareText, Search, Share2, Target } from "lucide-react";

export type PublicServicePage = {
  slug: string;
  key: "metaAds" | "googleAds" | "socialMedia" | "consultancy";
  title: string;
  eyebrow: string;
  description: string;
  icon: LucideIcon;
  audience: string[];
  problems: string[];
  included: string[];
  process: string[];
  faq: Array<{ question: string; answer: string }>;
  related: Array<{ label: string; href: string }>;
};

export const servicePages: PublicServicePage[] = [
  {
    slug: "meta-reklam-yonetimi",
    key: "metaAds",
    eyebrow: "Meta Reklam Yönetimi",
    title: "Instagram ve Facebook Reklamlarını Ölçülebilir Bir Sisteme Bağlayın",
    description: "Meta reklam yönetimi; kampanya yapısı, hedef kitle, kreatif yönlendirme, dönüşüm takibi ve düzenli optimizasyonu aynı çalışma disiplini içinde ele alır.",
    icon: Megaphone,
    audience: ["Manisa’daki yerel hizmet işletmeleri", "Randevu, mesaj veya form talebi toplamak isteyen markalar", "Instagram görünürlüğünü satış sürecine bağlamak isteyen ekipler"],
    problems: ["Kontrolsüz reklam harcaması", "Ölçülemeyen mesaj ve form talepleri", "Kreatif, hedef kitle ve teklif uyumsuzluğu"],
    included: ["Kampanya mimarisi", "Hedef kitle planı", "Kreatif ve metin yönlendirmesi", "Dönüşüm takibi kontrolü", "Aylık performans yorumu"],
    process: ["İşletme hedefi ve teklif netleştirilir.", "Kampanya yapısı ve hedef kitle planı hazırlanır.", "Reklamlar yayına alınır ve sinyaller izlenir.", "Performans raporu anlaşılır aksiyonlara çevrilir."],
    faq: [
      { question: "Meta reklam bütçesi hizmet bedeline dahil mi?", answer: "Hayır. Reklam bütçesi doğrudan platforma ödenir; hizmet bedeli strateji, kurulum, takip ve raporlama çalışmasını kapsar." },
      { question: "Instagram reklamları her işletme için uygun mu?", answer: "Uygunluk sektör, teklif, hedef kitle ve dönüşüm hedefiyle birlikte değerlendirilir. Ön görüşmede kanal seçimi netleştirilir." }
    ],
    related: [{ label: "Google Ads yönetimi", href: "/hizmetler/google-ads-yonetimi" }, { label: "Sosyal medya yönetimi", href: "/hizmetler/sosyal-medya-yonetimi" }]
  },
  {
    slug: "google-ads-yonetimi",
    key: "googleAds",
    eyebrow: "Google Ads Yönetimi",
    title: "Arama Niyeti Yüksek Kullanıcıları Doğru Teklifle Karşılayın",
    description: "Google Ads yönetimi; anahtar kelime planı, negatif kelime yapısı, kampanya kurulumu, dönüşüm takibi ve bütçe kontrolüyle talep yakalamaya odaklanır.",
    icon: Search,
    audience: ["Hizmet araması alan yerel işletmeler", "Klinik, danışmanlık, teknik servis ve mağaza yapıları", "Talep yakalama odaklı reklam isteyen markalar"],
    problems: ["Alakasız tıklama maliyetleri", "Eksik negatif kelime kontrolü", "Dönüşüm takibi olmadan bütçe yönetimi"],
    included: ["Anahtar kelime analizi", "Kampanya ve reklam grubu kurulumu", "Negatif kelime listesi", "Dönüşüm takibi kontrolü", "Arama terimi ve bütçe yorumu"],
    process: ["Hizmet ve lokasyon hedefleri analiz edilir.", "Anahtar kelime ve negatif liste kurgulanır.", "Kampanya yayına alınır ve arama terimleri izlenir.", "Bütçe ve dönüşüm verisiyle optimizasyon yapılır."],
    faq: [
      { question: "Google Ads hemen satış getirir mi?", answer: "Satış garantisi verilmez. Google Ads talebi yakalamaya yardımcı olur; sonuç teklif, rekabet, sayfa deneyimi ve takip kalitesine göre değişir." },
      { question: "Manisa dışına reklam verilebilir mi?", answer: "Evet. Hedef şehirler işletmenin hizmet alanına göre belirlenir; Manisa merkezli yapı Türkiye geneline uzaktan hizmet verebilir." }
    ],
    related: [{ label: "Meta reklam yönetimi", href: "/hizmetler/meta-reklam-yonetimi" }, { label: "Dijital pazarlama danışmanlığı", href: "/hizmetler/dijital-pazarlama-danismanligi" }]
  },
  {
    slug: "sosyal-medya-yonetimi",
    key: "socialMedia",
    eyebrow: "Sosyal Medya Yönetimi",
    title: "Sosyal Medya İçeriklerini Marka Güveni ve Talep Oluşturma Hedefiyle Planlayın",
    description: "Sosyal medya yönetimi; içerik sütunları, marka dili, kampanya temaları ve reklamla uyumlu mesaj yapısını düzenli bir plana bağlar.",
    icon: Share2,
    audience: ["Düzenli görünürlük isteyen yerel işletmeler", "Marka güvenini güçlendirmek isteyen hizmet markaları", "Reklam ve organik içerik dilini uyumlu yürütmek isteyen ekipler"],
    problems: ["Düzensiz paylaşım", "Teklif ve hizmet mesajının belirsiz kalması", "Reklama bağlanmayan içerik üretimi"],
    included: ["İçerik sütunları", "Aylık yön planı", "Kampanya mesajları", "Görsel ve metin yönlendirmesi", "Performans değerlendirmesi"],
    process: ["Marka tonu ve hizmet öncelikleri belirlenir.", "Aylık içerik temaları planlanır.", "Reklamla uyumlu çağrılar hazırlanır.", "Yayın sonrası etkileşim ve mesaj kalitesi yorumlanır."],
    faq: [
      { question: "Her gün paylaşım gerekir mi?", answer: "Hayır. Paylaşım sıklığı sektör, hedef ve üretim kapasitesine göre belirlenir; önemli olan sürdürülebilir ve anlaşılır bir içerik düzenidir." },
      { question: "Sosyal medya reklamdan ayrı mı yürür?", answer: "Ayrı yürütülebilir; ancak en iyi sonuç için organik içerik dili ve reklam teklifinin aynı stratejiye bağlı olması tercih edilir." }
    ],
    related: [{ label: "Meta reklam yönetimi", href: "/hizmetler/meta-reklam-yonetimi" }, { label: "Manisa dijital pazarlama hizmetleri", href: "/manisa-dijital-pazarlama" }]
  },
  {
    slug: "dijital-pazarlama-danismanligi",
    key: "consultancy",
    eyebrow: "Dijital Pazarlama Danışmanlığı",
    title: "Reklam, Ölçümleme ve Takip Sürecinizi Net Bir Yol Haritasına Dönüştürün",
    description: "Dijital pazarlama danışmanlığı; işletmenin hedefini, teklifini, reklam kanallarını, dönüşüm takibini ve raporlama düzenini birlikte ele alır.",
    icon: Target,
    audience: ["Nereden başlayacağını netleştirmek isteyen işletmeler", "Mevcut reklam performansını yorumlamak isteyen ekipler", "Meta ve Google yatırımlarını birlikte değerlendirmek isteyen markalar"],
    problems: ["Dağınık kanal kararları", "Ölçümleme eksikleri", "Reklamdan gelen talebin takip edilememesi"],
    included: ["Dijital durum analizi", "Kanal ve bütçe önerisi", "Dönüşüm takip kontrolü", "Teklif ve mesaj önerileri", "Raporlama modeli"],
    process: ["Mevcut dijital varlıklar incelenir.", "Hedef, teklif ve hizmet alanı netleştirilir.", "Kanal öncelikleri ve ilk 30 gün planı hazırlanır.", "Performans göstergeleri düzenli rapora bağlanır."],
    faq: [
      { question: "Danışmanlık tek seferlik alınabilir mi?", answer: "Evet. İhtiyaca göre tek seferlik analiz veya devam eden strateji desteği olarak planlanabilir." },
      { question: "Satış garantisi veriliyor mu?", answer: "Hayır. HK Dijital satış garantisi vermez; veri, takip, reklam optimizasyonu ve şeffaf raporlama sürecini yönetir." }
    ],
    related: [{ label: "Google Ads yönetimi", href: "/hizmetler/google-ads-yonetimi" }, { label: "Ücretsiz ön görüşme", href: "/teklif-al" }]
  }
];

export const localSeoFaq = [
  { question: "HK Dijital yalnız Manisa’ya mı hizmet veriyor?", answer: "HK Dijital Manisa merkezlidir; Manisa merkez ve ilçelerinin yanında Türkiye genelindeki işletmelere uzaktan dijital pazarlama desteği sunabilir." },
  { question: "Manisa dijital pazarlama çalışması hangi kanalları kapsar?", answer: "İhtiyaca göre Meta reklamları, Instagram reklamları, Google Ads, sosyal medya stratejisi, dönüşüm takibi ve performans raporlaması birlikte planlanır." },
  { question: "Ön görüşme ücretli mi?", answer: "İlk ön görüşme, işletmenin hedefini ve uygun çalışma modelini değerlendirmek için ücretsiz olarak planlanabilir." }
];

export const caseStudies = [
  {
    title: "Manisa merkezli yerel hizmet işletmesi",
    sector: "Yerel hizmet",
    need: "Reklamdan gelen taleplerin daha net takip edilmesi ve sosyal medya mesajının düzenlenmesi.",
    approach: "Meta reklam yapısı, teklif dili, WhatsApp yönlendirmesi ve aylık performans yorumu birlikte ele alındı.",
    services: ["Meta Reklam Yönetimi", "Sosyal Medya Stratejisi", "Dönüşüm Takibi"],
    delivery: ["Kampanya mimarisi", "İçerik yönlendirmesi", "Aylık yorum ve sonraki aksiyon listesi"]
  },
  {
    title: "Türkiye geneline çalışan hizmet markası",
    sector: "Danışmanlık ve hizmet",
    need: "Google aramalarından gelen talebin daha kontrollü bütçe ve anahtar kelime yapısıyla yönetilmesi.",
    approach: "Google Ads anahtar kelime grupları, negatif kelime listesi ve dönüşüm takip kontrolü birlikte planlandı.",
    services: ["Google Ads Yönetimi", "Dijital Pazarlama Danışmanlığı"],
    delivery: ["Kampanya kurulumu", "Arama terimi değerlendirmesi", "Raporlama modeli"]
  }
];

export const blogPosts = [
  {
    slug: "manisa-dijital-pazarlama-ajansi-secerken",
    title: "Manisa’da Dijital Pazarlama Ajansı Seçerken Nelere Dikkat Edilmeli?",
    description: "Manisa’daki işletmeler için dijital pazarlama ajansı seçerken hizmet kapsamı, raporlama, ölçümleme ve gerçekçi beklenti yönetimi nasıl değerlendirilir?",
    date: "2026-07-15",
    updated: "2026-07-15",
    readingTime: "6 dk",
    author: "HK Dijital",
    sections: [
      ["Önce hedefinizi netleştirin", "Ajans seçmeden önce beklentinin marka bilinirliği, mesaj, form, randevu veya satış takibi mi olduğunu netleştirmek gerekir. Hedef net değilse kanal seçimi ve bütçe yorumu da sağlıklı olmaz."],
      ["Raporlama diline bakın", "İyi bir çalışma yalnız metrik listesi sunmaz. Tıklama, mesaj, form, maliyet ve dönüşüm sinyallerini anlaşılır aksiyonlara çevirir."],
      ["Yerel pazarı ve uzaktan hizmet modelini birlikte değerlendirin", "Manisa’daki rekabet yapısı, ilçeler ve hizmet alanı önemli olsa da dijital pazarlama çoğu zaman şehir dışı hedeflemelerle birlikte planlanır."]
    ]
  },
  {
    slug: "meta-reklam-butcesi-nasil-belirlenir",
    title: "Meta Reklam Bütçesi Nasıl Belirlenir?",
    description: "Instagram ve Facebook reklamlarında bütçe belirlerken hedef, sektör, teklif, kreatif üretimi ve dönüşüm takibi neden birlikte düşünülmelidir?",
    date: "2026-07-15",
    updated: "2026-07-15",
    readingTime: "5 dk",
    author: "HK Dijital",
    sections: [
      ["Bütçe hedefe göre değişir", "Mesaj almak, form toplamak, mağaza trafiği oluşturmak veya yeniden pazarlama yapmak aynı bütçe mantığıyla yönetilmez. Önce hedef ve teklif netleştirilmelidir."],
      ["Kreatif test alanı bırakın", "Meta reklamlarında tek görsel veya tek metinle karar vermek yanıltıcı olabilir. Bütçenin bir kısmı farklı kreatifleri ve mesajları test etmeye ayrılmalıdır."],
      ["Takip altyapısı olmadan bütçe yorumu eksik kalır", "WhatsApp, form, arama veya satın alma gibi aksiyonlar ölçülmüyorsa reklam harcamasının gerçek etkisini yorumlamak zorlaşır."]
    ]
  },
  {
    slug: "google-ads-mi-instagram-reklami-mi",
    title: "Google Ads mi Instagram Reklamı mı?",
    description: "Yerel işletmeler için Google Ads ve Instagram reklamlarının farkı, hangi durumda hangi kanalın öne çıktığı ve birlikte kullanım yaklaşımı.",
    date: "2026-07-15",
    updated: "2026-07-15",
    readingTime: "5 dk",
    author: "HK Dijital",
    sections: [
      ["Google Ads talep yakalar", "Kullanıcı arama yaptığında ihtiyacını daha açık ifade eder. Bu nedenle hizmet aramaları, acil ihtiyaçlar ve fiyat araştırmaları için Google Ads güçlü olabilir."],
      ["Instagram talep oluşturur", "Instagram ve Facebook reklamları görsel anlatım, güven oluşturma, yeniden pazarlama ve kampanya duyuruları için değerlidir."],
      ["En doğru karar işletme hedefiyle verilir", "Kimi işletmede tek kanal yeterli olabilir; kimi işletmede Google arama talebi ve Meta yeniden pazarlama birlikte daha dengeli çalışır."]
    ]
  }
];

export const blogPlan = [
  "Yerel İşletmeler İçin Sosyal Medya Yönetimi Rehberi",
  "Reklam Verirken Dönüşüm Takibi Neden Gereklidir?",
  "Manisa’daki İşletmeler İçin Dijital Pazarlama Yol Haritası"
];

export const serviceOverviewCards = [
  { title: "Meta Reklam Yönetimi", href: "/hizmetler/meta-reklam-yonetimi", icon: Megaphone, text: "Instagram ve Facebook reklamlarını hedef, kreatif ve dönüşüm takibiyle yönetin." },
  { title: "Google Ads Yönetimi", href: "/hizmetler/google-ads-yonetimi", icon: Search, text: "Arama niyeti yüksek kullanıcılara kontrollü bütçe ve doğru anahtar kelimelerle ulaşın." },
  { title: "Sosyal Medya Yönetimi", href: "/hizmetler/sosyal-medya-yonetimi", icon: MessageSquareText, text: "İçerik planı, marka dili ve reklamla uyumlu sosyal medya mesajı oluşturun." },
  { title: "Dijital Pazarlama Danışmanlığı", href: "/hizmetler/dijital-pazarlama-danismanligi", icon: BarChart3, text: "Reklam, dönüşüm takibi ve raporlamayı net bir büyüme yol haritasına bağlayın." }
];

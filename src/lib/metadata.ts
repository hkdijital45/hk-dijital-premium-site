import type { Metadata } from "next";
import { getSiteContent } from "./content";

export const SITE_URL = "https://www.hkdijital.com.tr";

export const publicPagePaths: Record<string, string> = {
  home: "/",
  about: "/hakkimda",
  services: "/hizmetler",
  packages: "/paketler",
  quote: "/teklif-al",
  contact: "/iletisim",
  certificates: "/sertifikalar",
  intelligence: "/hk-intelligence",
  manisa: "/manisa-dijital-pazarlama",
  blog: "/blog",
  metaAds: "/hizmetler/meta-reklam-yonetimi",
  googleAds: "/hizmetler/google-ads-yonetimi",
  socialMedia: "/hizmetler/sosyal-medya-yonetimi",
  consultancy: "/hizmetler/dijital-pazarlama-danismanligi"
};

const fallbackSeo: Record<string, { title: string; description: string }> = {
  home: {
    title: "Manisa Dijital Pazarlama Ajansı | HK Dijital",
    description: "HK Dijital; Manisa merkezli Meta reklam yönetimi, Google Ads, sosyal medya stratejisi, dönüşüm takibi ve dijital pazarlama danışmanlığı sunar."
  },
  services: {
    title: "Dijital Pazarlama Hizmetleri | HK Dijital",
    description: "Meta reklam yönetimi, Google Ads, sosyal medya yönetimi, ölçümleme ve dijital pazarlama danışmanlığı hizmetlerini inceleyin."
  },
  packages: {
    title: "Dijital Pazarlama Paketleri | HK Dijital",
    description: "Meta reklam, Google Ads ve sosyal medya hizmet paketlerini kapsam, fiyat ve çalışma modeliyle karşılaştırın."
  },
  about: {
    title: "Hakkımızda | HK Dijital",
    description: "HK Dijital’in Manisa merkezli dijital pazarlama, reklam yönetimi, ölçümleme ve şeffaf raporlama yaklaşımını inceleyin."
  },
  contact: {
    title: "İletişim | HK Dijital",
    description: "Manisa dijital pazarlama ajansı HK Dijital ile ücretsiz ön görüşme, Meta reklam ve Google Ads danışmanlığı için iletişime geçin."
  },
  quote: {
    title: "Ücretsiz Ön Görüşme | HK Dijital",
    description: "İşletmeniz için Meta reklam, Google Ads, sosyal medya veya dijital pazarlama danışmanlığı görüşmesi talep edin."
  },
  manisa: {
    title: "Manisa Dijital Pazarlama Ajansı | HK Dijital",
    description: "Manisa’daki işletmeler için Meta reklamları, Google Ads, sosyal medya yönetimi, dönüşüm takibi ve anlaşılır performans raporlaması."
  },
  blog: {
    title: "Dijital Pazarlama Blogu | HK Dijital",
    description: "Manisa’daki ve Türkiye genelindeki işletmeler için dijital pazarlama, reklam bütçesi, Meta reklamları ve Google Ads rehberleri."
  },
  metaAds: {
    title: "Meta Reklam Yönetimi | HK Dijital",
    description: "Instagram ve Facebook reklamları için kampanya kurulumu, hedef kitle planı, kreatif yönlendirme ve performans takibi."
  },
  googleAds: {
    title: "Google Ads Yönetimi | HK Dijital",
    description: "Arama niyeti yüksek kullanıcılara ulaşmak için Google Ads kampanya mimarisi, anahtar kelime planı ve dönüşüm takibi."
  },
  socialMedia: {
    title: "Sosyal Medya Yönetimi | HK Dijital",
    description: "Yerel işletmeler ve markalar için sosyal medya stratejisi, içerik planı, reklamla uyumlu mesaj dili ve performans yorumu."
  },
  consultancy: {
    title: "Dijital Pazarlama Danışmanlığı | HK Dijital",
    description: "Manisa merkezli işletmeler için reklam, ölçümleme, teklif, dönüşüm ve raporlama süreçlerini netleştiren danışmanlık."
  }
};

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function safeJsonLd(data: Record<string, unknown> | Array<Record<string, unknown>>) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export async function pageMetadata(key: string, overrides: Partial<Metadata> = {}): Promise<Metadata> {
  const content = await getSiteContent();
  const seo = key === "home"
    ? fallbackSeo.home
    : content.seo[key] ?? fallbackSeo[key] ?? content.seo.home ?? fallbackSeo.home;
  const canonicalPath = publicPagePaths[key] ?? "/";
  const title = String(overrides.title || seo.title);
  const description = String(overrides.description || seo.description);
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      absolute: title
    },
    description,
    keywords: [
      "Manisa dijital pazarlama ajansı",
      "Manisa reklam ajansı",
      "Manisa dijital pazarlama",
      "Manisa sosyal medya yönetimi",
      "Meta reklam yönetimi",
      "Google Ads yönetimi",
      "dijital reklam danışmanlığı",
      "performans pazarlama"
    ],
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: content.brand.companyName,
      locale: "tr_TR",
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true
      }
    },
    authors: [{ name: content.brand.founder || content.brand.companyName }],
    creator: content.brand.companyName,
    publisher: content.brand.companyName,
    ...overrides
  };
}

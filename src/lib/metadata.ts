import type { Metadata } from "next";
import { getSiteContent } from "./content";

export async function pageMetadata(key: string): Promise<Metadata> {
  const content = await getSiteContent();
  const seo = content.seo[key] ?? content.seo.home;
  return {
    title: seo.title,
    description: seo.description,
    keywords: [
      "dijital pazarlama uzmanı",
      "Manisa dijital pazarlama",
      "Meta reklam yönetimi",
      "Google Ads yönetimi",
      "sosyal medya uzmanı",
      "reklam danışmanlığı",
      "performans pazarlama",
      "AI destekli dijital analiz",
      "CRM müşteri takip sistemi"
    ]
  };
}

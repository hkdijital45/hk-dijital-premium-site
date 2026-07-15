import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/metadata";
import { getBlogSitemapEntries } from "@/lib/blog-seo";
import { servicePages } from "@/lib/public-seo-content";

const staticRoutes = [
  "/",
  "/hizmetler",
  "/paketler",
  "/hakkimda",
  "/blog",
  "/iletisim",
  "/teklif-al",
  "/manisa-dijital-pazarlama",
  "/gizlilik-politikasi",
  "/kullanim-sartlari",
  "/veri-silme"
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const blogRoutes = await getBlogSitemapEntries();
  return [
    ...staticRoutes.map((route) => ({
      url: absoluteUrl(route),
      lastModified: now,
      changeFrequency: route === "/" ? "weekly" as const : "monthly" as const,
      priority: route === "/" ? 1 : route === "/manisa-dijital-pazarlama" ? 0.9 : 0.7
    })),
    ...servicePages.map((service) => ({
      url: absoluteUrl(`/hizmetler/${service.slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.8
    })),
    ...blogRoutes.map((post) => ({
      url: post.url,
      lastModified: new Date(post.lastModified),
      changeFrequency: "monthly" as const,
      priority: 0.65
    }))
  ];
}

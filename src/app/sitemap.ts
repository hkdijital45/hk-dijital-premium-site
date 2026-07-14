import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/metadata";
import { blogPosts, servicePages } from "@/lib/public-seo-content";

const staticRoutes = [
  "/",
  "/hizmetler",
  "/paketler",
  "/calismalarimiz",
  "/hakkimda",
  "/blog",
  "/iletisim",
  "/teklif-al",
  "/manisa-dijital-pazarlama",
  "/gizlilik-politikasi",
  "/kullanim-sartlari",
  "/veri-silme"
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
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
    ...blogPosts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: new Date(post.updated),
      changeFrequency: "monthly" as const,
      priority: 0.65
    }))
  ];
}

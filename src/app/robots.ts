import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/hk-admin/",
          "/musteri-paneli",
          "/musteri-merkezi",
          "/digital-center",
          "/auth/",
          "/login",
          "/giris",
          "/sifre-sifirla",
          "/sifre-degistir",
          "/kurulum",
          "/super-admin-kurulum",
          "/lead-workspace",
          "/proposal-builder"
        ]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}

import type { Metadata } from "next";
import { getSiteContent } from "@/lib/content";
import { pageMetadata, SITE_URL } from "@/lib/metadata";
import { HomepageExperience } from "@/components/public/HomepageExperience";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("home");
}

export default async function Home() {
  const content = await getSiteContent();

  return (
    <PublicShell>
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: content.brand.companyName,
          url: SITE_URL,
          email: content.contact.email,
          telephone: content.contact.phone,
          founder: content.brand.founder,
          areaServed: ["Manisa", "Türkiye"],
          sameAs: Object.values(content.socials).filter((url) => url && !/^https:\/\/(instagram|facebook|youtube|x|linkedin|tiktok)\.com\/?$/.test(url))
        },
        {
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: content.brand.companyName,
          url: SITE_URL,
          description: "Manisa merkezli, Türkiye geneline hizmet veren dijital pazarlama ve reklam danışmanlığı ajansı.",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Manisa",
            addressCountry: "TR"
          },
          areaServed: ["Manisa", "Türkiye"],
          telephone: content.contact.phone,
          email: content.contact.email
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: content.brand.companyName,
          url: SITE_URL
        }
      ]} />
      <HomepageExperience content={content} />
    </PublicShell>
  );
}

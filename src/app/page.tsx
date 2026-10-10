import { resolvePublicPhoneE164 } from "@/lib/public-contact";
import type { Metadata } from "next";
import { getSiteContent } from "@/lib/content";
import { getActiveBrandShowcases } from "@/lib/brand-showcase-public";
import { pageMetadata, SITE_URL } from "@/lib/metadata";
import { HomepageExperience } from "@/components/public/HomepageExperience";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("home");
}

export default async function Home() {
  // getSiteContent() itself is request-deduped now (see src/lib/content.ts)
  // — this call and PublicShell's own getSiteContent() call below no
  // longer mean two real Supabase round-trips per request. A cross-request
  // cache (unstable_cache) was also tried here, but the site_content +
  // brand_showcases payload is ~3.4MB — over Next's 2MB data-cache entry
  // limit — so it silently never cached; removed rather than keep
  // ineffective code. The real remaining cost is that payload size itself,
  // which is a separate, larger fix (trimming what getSiteContent actually
  // needs to return) than this pass had room for.
  const [content, brands] = await Promise.all([getSiteContent(), getActiveBrandShowcases()]);

  return (
    <PublicShell>
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: content.brand.companyName,
          url: SITE_URL,
          email: content.contact.email,
          telephone: resolvePublicPhoneE164(content.contact.phone) ?? undefined,
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
          telephone: resolvePublicPhoneE164(content.contact.phone) ?? undefined,
          email: content.contact.email
        },
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: content.brand.companyName,
          url: SITE_URL
        }
      ]} />
      <HomepageExperience content={content} brands={brands} />
    </PublicShell>
  );
}

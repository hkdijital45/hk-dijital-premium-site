import { resolvePublicPhoneE164 } from "@/lib/public-contact";
import type { Metadata } from "next";
import { getPublicSiteContent } from "@/lib/content";
import { pageMetadata, SITE_URL } from "@/lib/metadata";
import { HomepageExperience } from "@/components/public/HomepageExperience";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("home");
}

export default async function Home() {
  // getPublicSiteContent queries Supabase for only brand/socials/contact
  // (PostgREST JSON-path select — a few KB instead of the full ~3.2 MB
  // site_content row, which also carries real leads/users/customer data
  // that must never reach HomepageExperience, a "use client" component —
  // see PublicSiteContent in types.ts). The homepage no longer renders a
  // brand gallery at all (moved to /calistigimiz-markalar only, Phase 4
  // IA simplification), so getActiveBrandShowcases() is no longer called
  // here either — one less query on the highest-traffic page.
  const content = await getPublicSiteContent();

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
          // Full street address is only ever exposed when the admin's
          // "Adres ve harita web sitesinde gösterilsin" toggle is on —
          // the city-level locality stays regardless, it's not specific
          // enough to be the thing that toggle is meant to hide.
          address: {
            "@type": "PostalAddress",
            streetAddress: content.contact.addressVisible !== false ? content.contact.address || undefined : undefined,
            addressLocality: content.contact.city || "Manisa",
            addressRegion: content.contact.district || undefined,
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
      <HomepageExperience content={content} />
    </PublicShell>
  );
}

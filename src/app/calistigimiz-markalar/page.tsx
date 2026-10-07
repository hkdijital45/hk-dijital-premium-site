import type { Metadata } from "next";
import Image from "next/image";
import { Handshake } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { MarketingPageHero, MarketingReveal, MarketingSection } from "@/components/public/marketing/MarketingUI";
import { absoluteUrl, pageMetadata } from "@/lib/metadata";
import { getActiveBrandShowcases } from "@/lib/brand-showcase-public";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("brands");
}

// Full portfolio of active public.brand_showcases rows (sort_order ASC) — the
// homepage's "HK Dijital ile Çalışan Markalar" teaser links here for the
// complete list. Same server-side, service-role read as the homepage section
// (getActiveBrandShowcases); no separate data source, no hard-coded brands.
export default async function BrandsPortfolioPage() {
  const brands = await getActiveBrandShowcases();

  return (
    <PublicShell>
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Çalıştığımız Markalar", item: absoluteUrl("/calistigimiz-markalar") }
          ]
        }
      ]} />
      <div className="marketing-shell">
        <MarketingPageHero
          eyebrow="Çalıştığımız Markalar"
          title="Birlikte Değer Ürettiğimiz Markalar"
          text="Farklı sektörlerdeki marka ve kurumların dijital süreçlerine strateji, reklam, sosyal medya ve teknoloji çözümleriyle katkı sağlıyoruz."
        />

        <MarketingSection id="marka-portfoyu">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {brands.length === 0 ? (
              <MarketingReveal className="mx-auto max-w-xl">
                <div className="rounded-[20px] border px-6 py-16 text-center" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
                  <span className="mx-auto grid size-12 place-items-center rounded-full" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-violet)" }} aria-hidden="true">
                    <Handshake size={22} />
                  </span>
                  <p className="mt-4 text-lg font-black" style={{ color: "var(--mk-ink)" }}>Marka portföyümüz yakında burada.</p>
                </div>
              </MarketingReveal>
            ) : (
              <div className="columns-1 gap-6 sm:columns-2 lg:columns-3">
                {brands.map((brand, index) => (
                  <MarketingReveal key={brand.id} delay={Math.min(index, 5) * 0.05} className="mb-6 break-inside-avoid">
                    <article className="marketing-card flex flex-col gap-4 p-6">
                      <div className="flex items-center gap-4">
                        <div
                          className="grid size-16 shrink-0 place-items-center rounded-[14px] border bg-white p-2.5"
                          style={{ borderColor: "var(--mk-border-strong)" }}
                        >
                          {brand.logoUrl && (
                            <Image
                              src={brand.logoUrl}
                              alt={`${brand.name} logosu`}
                              width={56}
                              height={56}
                              className="h-full w-full object-contain"
                              sizes="56px"
                              unoptimized
                            />
                          )}
                        </div>
                        <h2 className="min-w-0 break-words text-lg font-black leading-tight" style={{ color: "var(--mk-ink)" }}>{brand.name}</h2>
                      </div>

                      {brand.services.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {brand.services.map((service) => (
                            <span key={service} className="marketing-badge">{service}</span>
                          ))}
                        </div>
                      )}

                      {brand.description && (
                        <p className="text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{brand.description}</p>
                      )}
                    </article>
                  </MarketingReveal>
                ))}
              </div>
            )}
          </div>
        </MarketingSection>
      </div>
    </PublicShell>
  );
}

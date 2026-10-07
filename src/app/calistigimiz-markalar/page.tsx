import type { Metadata } from "next";
import Image from "next/image";
import { Check, Handshake } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { MarketingPageHero, MarketingReveal } from "@/components/public/marketing/MarketingUI";
import { absoluteUrl, pageMetadata } from "@/lib/metadata";
import { getActiveBrandShowcases } from "@/lib/brand-showcase-public";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("brands");
}

// Premium accent for the "Verdiğimiz Hizmetler" check marks only — never the
// whole row — scoped locally rather than a global design-token change.
const LIME = "#9ee635";

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

        <section id="marka-portfoyu" className="pb-20 pt-10 sm:pb-24 sm:pt-14" style={{ background: "var(--mk-bg-alt)" }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
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
              <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 sm:gap-8">
                {brands.map((brand, index) => {
                  const isLoneLast = brands.length % 2 === 1 && index === brands.length - 1;
                  return (
                    <div key={brand.id} className={isLoneLast ? "sm:col-span-2 sm:flex sm:justify-center" : ""}>
                      <MarketingReveal delay={Math.min(index, 5) * 0.05} className={isLoneLast ? "w-full sm:max-w-[calc(50%-1rem)]" : ""}>
                        <article className="marketing-card relative flex h-full flex-col gap-6 overflow-hidden p-7 sm:p-9">
                          <span aria-hidden className="absolute inset-x-9 top-0 h-[3px] rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${LIME}, transparent)` }} />

                          <div className="flex items-center gap-5">
                            <div className="grid size-20 shrink-0 place-items-center rounded-[16px] border bg-white p-3 sm:size-24" style={{ borderColor: "var(--mk-border-strong)" }}>
                              {brand.logoUrl && (
                                <Image
                                  src={brand.logoUrl}
                                  alt={`${brand.name} logosu`}
                                  width={88}
                                  height={88}
                                  className="h-full w-full object-contain"
                                  sizes="88px"
                                  unoptimized
                                />
                              )}
                            </div>
                            <h2 className="min-w-0 break-words text-2xl font-black leading-tight sm:text-3xl" style={{ color: "var(--mk-ink)" }}>{brand.name}</h2>
                          </div>

                          {brand.services.length > 0 && (
                            <div>
                              <p className="text-xs font-black uppercase tracking-[.12em]" style={{ color: "var(--mk-ink-faint)" }}>Verdiğimiz Hizmetler</p>
                              <ul className="mt-3 grid gap-2.5">
                                {brand.services.map((service) => (
                                  <li key={service} className="flex items-start gap-2.5">
                                    <span
                                      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full"
                                      style={{ background: "rgba(158,230,53,.14)", boxShadow: `0 0 7px rgba(158,230,53,.45)` }}
                                      aria-hidden="true"
                                    >
                                      <Check size={12} strokeWidth={3} style={{ color: LIME }} />
                                    </span>
                                    <span className="text-sm leading-6 sm:text-base" style={{ color: "var(--mk-ink)" }}>{service}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {brand.description && (
                            <p className="border-t pt-5 text-sm leading-7" style={{ borderColor: "var(--mk-border)", color: "var(--mk-ink-soft)" }}>{brand.description}</p>
                          )}
                        </article>
                      </MarketingReveal>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

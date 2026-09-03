import type { Metadata } from "next";
import Link from "next/link";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { serviceIcons } from "@/lib/icons";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard, MarketingPageHero, MarketingReveal, MarketingSection } from "@/components/public/marketing/MarketingUI";
import { servicePages } from "@/lib/public-seo-content";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("services");
}

export default async function ServicesPage() {
  const content = await getSiteContent();

  return (
    <PublicShell>
      <div className="marketing-shell">
        <MarketingPageHero eyebrow="Hizmetler" title="Manisa Dijital Pazarlama Hizmetleri" text="Meta reklam yönetimi, Google Ads, sosyal medya stratejisi, dönüşüm takibi ve anlaşılır raporlamayı işletmenizin hedeflerine göre planlayın." />
        <MarketingSection>
          <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:px-8">
            <MarketingReveal>
              <MarketingCard className="p-7">
                <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Öne çıkan hizmet sayfaları</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>Hizmet kapsamını, kimler için uygun olduğunu ve çalışma sürecini detaylı inceleyin.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {servicePages.map((service) => (
                    <Link key={service.slug} href={`/hizmetler/${service.slug}`} className="rounded-full border px-4 py-2 text-sm font-black transition hover:text-white hover:bg-[#7c3aed]" style={{ borderColor: "var(--mk-border-strong)", color: "var(--mk-violet)" }}>
                      {service.eyebrow}
                    </Link>
                  ))}
                </div>
              </MarketingCard>
            </MarketingReveal>
            {content.services
              .filter((service) => service.visible)
              .sort((a, b) => a.order - b.order)
              .map((service, index) => {
                const Icon = serviceIcons[service.icon] ?? serviceIcons.Sparkles;
                return (
                  <MarketingReveal key={service.id} delay={index * 0.03}>
                    <MarketingCard className="p-7">
                      <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
                        <div>
                          <div className="grid size-12 place-items-center rounded-xl" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-violet)" }}>
                            <Icon size={22} />
                          </div>
                          <h2 id={service.id === "landing" ? "web-donusum" : service.id === "reporting" ? "raporlama" : undefined} className="mt-5 text-2xl font-black" style={{ color: "var(--mk-ink)" }}>{service.name}</h2>
                          <p className="mt-4 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{service.detailedDescription}</p>
                          <Link href="/teklif-al" className="marketing-btn marketing-btn-primary mt-6">{service.cta}</Link>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <h3 className="font-black" style={{ color: "var(--mk-violet)" }}>Kimler için?</h3>
                            <p className="mt-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{service.audience}</p>
                          </div>
                          <div>
                            <h3 className="font-black" style={{ color: "var(--mk-violet)" }}>Hangi problemi çözer?</h3>
                            <p className="mt-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{service.problem}</p>
                          </div>
                          <div>
                            <h3 className="font-black" style={{ color: "var(--mk-violet)" }}>Neler dahil?</h3>
                            <ul className="mt-3 space-y-2 text-sm" style={{ color: "var(--mk-ink-soft)" }}>
                              {service.included.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </MarketingCard>
                  </MarketingReveal>
                );
              })}
          </div>
        </MarketingSection>
      </div>
    </PublicShell>
  );
}

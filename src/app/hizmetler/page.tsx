import type { Metadata } from "next";
import Link from "next/link";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { serviceIcons } from "@/lib/icons";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";
import { servicePages } from "@/lib/public-seo-content";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("services");
}

export default async function ServicesPage() {
  const content = await getSiteContent();

  return (
    <PublicShell>
      <PageHero eyebrow="Hizmetler" title="Manisa Dijital Pazarlama Hizmetleri" text="Meta reklam yönetimi, Google Ads, sosyal medya stratejisi, dönüşüm takibi ve anlaşılır raporlamayı işletmenizin hedeflerine göre planlayın." />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5">
          <PremiumCard>
            <h2 className="text-2xl font-black text-white">Öne çıkan hizmet sayfaları</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Hizmet kapsamını, kimler için uygun olduğunu ve çalışma sürecini detaylı inceleyin.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {servicePages.map((service) => (
                <Link key={service.slug} href={`/hizmetler/${service.slug}`} className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-200 hover:text-slate-950">
                  {service.eyebrow}
                </Link>
              ))}
            </div>
          </PremiumCard>
          {content.services
            .filter((service) => service.visible)
            .sort((a, b) => a.order - b.order)
            .map((service) => {
              const Icon = serviceIcons[service.icon] ?? serviceIcons.Sparkles;
              return (
                <PremiumCard key={service.id}>
                  <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
                    <div>
                      <div className="grid size-12 place-items-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-200">
                        <Icon size={22} />
                      </div>
                      <h2 id={service.id === "landing" ? "web-donusum" : service.id === "reporting" ? "raporlama" : undefined} className="mt-5 text-2xl font-black text-white">{service.name}</h2>
                      <p className="mt-4 text-sm leading-7 text-slate-300">{service.detailedDescription}</p>
                      <Link href="/teklif-al" className="mt-6 inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">
                        {service.cta}
                      </Link>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <h3 className="font-black text-cyan-100">Kimler için?</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-300">{service.audience}</p>
                      </div>
                      <div>
                        <h3 className="font-black text-cyan-100">Hangi problemi çözer?</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-300">{service.problem}</p>
                      </div>
                      <div>
                        <h3 className="font-black text-cyan-100">Neler dahil?</h3>
                        <ul className="mt-3 space-y-2 text-sm text-slate-300">
                          {service.included.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                </PremiumCard>
              );
            })}
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

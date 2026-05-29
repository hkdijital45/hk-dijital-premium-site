import type { Metadata } from "next";
import Link from "next/link";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { serviceIcons } from "@/lib/icons";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("services");
}

export default async function ServicesPage() {
  const content = await getSiteContent();

  return (
    <PublicShell>
      <PageHero eyebrow="Hizmetler" title="Dijital pazarlama sisteminizi stratejik olarak kurun" text={content.pages.services.intro} />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5">
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
                      <h1 className="mt-5 text-2xl font-black text-white">{service.name}</h1>
                      <p className="mt-4 text-sm leading-7 text-slate-300">{service.detailedDescription}</p>
                      <Link href="/teklif-al" className="mt-6 inline-flex rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950">
                        {service.cta}
                      </Link>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <h2 className="font-black text-cyan-100">Kimler için?</h2>
                        <p className="mt-3 text-sm leading-7 text-slate-300">{service.audience}</p>
                      </div>
                      <div>
                        <h2 className="font-black text-cyan-100">Hangi problemi çözer?</h2>
                        <p className="mt-3 text-sm leading-7 text-slate-300">{service.problem}</p>
                      </div>
                      <div>
                        <h2 className="font-black text-cyan-100">Neler dahil?</h2>
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

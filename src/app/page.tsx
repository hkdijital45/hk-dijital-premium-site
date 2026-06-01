import type { Metadata } from "next";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { ButtonLink, GlowBackground, PremiumCard, SectionHeader } from "@/components/public/ui";
import { PackageCards, ServiceGrid } from "@/components/public/ServicePackageSections";
import { PublicShell } from "@/components/public/Shell";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("home");
}

export default async function Home() {
  const content = await getSiteContent();
  const home = content.pages.home;

  return (
    <PublicShell>
      <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 lg:px-8 lg:pb-24 lg:pt-28">
        <GlowBackground />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.08fr_.92fr]">
          <div>
            <p className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-sm font-bold text-cyan-100">
              Manisa dijital pazarlama ve performans pazarlama sistemi
            </p>
            <h1 className="mt-7 max-w-5xl text-4xl font-black leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
              {home.headline}
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300">{home.subheadline}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/teklif-al">{home.primaryCta}</ButtonLink>
              <ButtonLink href="/paketler" variant="ghost">{home.secondaryCta}</ButtonLink>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              {home.trustIndicators.map((item) => (
                <div key={item} className="rounded-[8px] border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <PremiumCard className="relative min-h-[460px] overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(18,217,255,.28),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(216,180,91,.20),transparent_26%)]" />
            <div className="relative grid gap-4">
              {["Dijital olgunluk skoru", "Reklam potansiyeli", "Müşteri yolculuğu eksikleri", "Potansiyel müşteri önceliği", "Bütçe önerisi"].map((item, index) => (
                <div key={item} className="rounded-[8px] border border-white/10 bg-black/30 p-4 backdrop-blur-xl" style={{ transform: `translateX(${index % 2 ? 20 : 0}px)` }}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-bold text-white">{item}</span>
                    <span className="text-sm font-black text-cyan-200">Analiz edilir</span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-cyan-300" style={{ width: `${62 + index * 6}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>
      </section>

      <AnimatedSection className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Hizmetler" title="Reklam, içerik ve analiz aynı stratejide buluşur" text="Dağınık dijital aksiyonlar yerine ölçülebilir strateji, kurulum, optimizasyon ve raporlama disiplini." />
          <div className="mt-12">
            <ServiceGrid services={content.services} />
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Süreç" title="Net adımlarla yönetilen büyüme sistemi" />
          <div className="mt-12 grid gap-4 md:grid-cols-3 xl:grid-cols-7">
            {home.process.map((step, index) => (
              <PremiumCard key={step}>
                <p className="text-sm font-black text-cyan-200">0{index + 1}</p>
                <h2 className="mt-4 text-xl font-black text-white">{step}</h2>
              </PremiumCard>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <SectionHeader eyebrow="HK Intelligence" title="Yapay zekâ destekli dijital analiz katmanı" text={home.intelligenceTeaser} />
          <PremiumCard>
            <div className="grid gap-3 sm:grid-cols-2">
              {content.pages.intelligence.features.slice(0, 6).map((feature) => (
                <div key={feature} className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-slate-200">
                  {feature}
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>
      </AnimatedSection>

      <AnimatedSection className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Paketler" title="İhtiyacınıza göre başlangıç, büyüme ve premium strateji" text={content.pages.packages.intro} />
          <div className="mt-12">
            <PackageCards packages={content.packages} />
          </div>
          <div className="mt-8 grid gap-3 text-sm text-slate-400 md:grid-cols-2">
            {home.disclaimers.map((item) => (
              <p key={item} className="rounded-[8px] border border-white/10 bg-white/[0.035] p-4">{item}</p>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

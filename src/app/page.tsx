import type { Metadata } from "next";
import Image from "next/image";
import { BarChart3, BrainCircuit, CheckCircle2, Gauge, Layers3, Target } from "lucide-react";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { ButtonLink, GlowBackground, PremiumCard, SectionHeader } from "@/components/public/ui";
import { PackageCards, ServiceGrid } from "@/components/public/ServicePackageSections";
import { PublicShell } from "@/components/public/Shell";
import {
  AIInsightCard,
  AnimatedChart,
  FloatingDashboardObject,
  GlassCard,
  PlatformSignalStrip,
  ReportPreview,
  ScrollScene3D
} from "@/components/premium/PremiumUI";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("home");
}

export default async function Home() {
  const content = await getSiteContent();
  const home = content.pages.home;

  return (
    <PublicShell>
      <section className="relative min-h-[760px] overflow-hidden border-b border-white/5 px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pb-28 lg:pt-28">
        <Image
          src="/images/hk-dijital-saas-hero.png"
          alt="HK Dijital reklam performansı ve yapay zekâ raporlama paneli"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[72%_center] opacity-80"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#030712_4%,rgba(3,7,18,.97)_34%,rgba(3,7,18,.54)_66%,rgba(3,7,18,.28))]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#050711] to-transparent" />
        <GlowBackground />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="inline-flex rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-sm font-bold text-cyan-100">
              HK Dijital Marketing OS · Manisa merkezli, Türkiye geneli
            </p>
            <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">
              {home.headline}
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">{home.subheadline}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/teklif-al">{home.primaryCta}</ButtonLink>
              <ButtonLink href="/paketler" variant="ghost">{home.secondaryCta}</ButtonLink>
            </div>
          </div>
          <div className="mt-12 max-w-5xl"><PlatformSignalStrip /></div>
          <div className="pointer-events-none absolute right-0 top-8 hidden h-[520px] w-[44%] xl:block">
            <FloatingDashboardObject className="right-0 top-4 w-48" delay={0.3}>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-100">Reklam görünürlüğü</p>
              <p className="mt-3 text-3xl font-black text-white">+38%</p>
            </FloatingDashboardObject>
            <FloatingDashboardObject className="bottom-12 right-14 w-52" delay={1}>
              <p className="text-[10px] font-black uppercase tracking-[.16em] text-amber-100">HK Intelligence</p>
              <p className="mt-3 text-sm font-bold text-white">Dijital olgunluk analizi hazır</p>
            </FloatingDashboardObject>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-5">
          {home.trustIndicators.map((item, index) => (
            <GlassCard key={item} className="p-4">
              <p className="text-xs font-black text-amber-100">0{index + 1}</p>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-100">{item}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <AnimatedSection className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[.95fr_1.05fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-100">Tek kontrol merkezi</p>
            <h2 className="mt-5 text-3xl font-black leading-tight text-white sm:text-5xl">Reklam, müşteri takibi ve yapay zekâ raporları aynı sistemde.</h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">Kampanya kararları yalnızca gösterim sayısına bakılarak verilmez. Reklam verisi, potansiyel müşteri kalitesi ve takip süreci birlikte değerlendirilir.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              {[["Meta & Google", BarChart3], ["CRM takibi", Target], ["AI yorumlama", BrainCircuit]].map(([label, Icon]) => (
                <div key={String(label)} className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.04] p-3 text-sm font-bold text-slate-200">
                  <Icon size={18} className="text-cyan-100" /> {String(label)}
                </div>
              ))}
            </div>
          </div>
          <ScrollScene3D><ReportPreview /></ScrollScene3D>
        </div>
      </AnimatedSection>

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
          <ScrollScene3D>
            <GlassCard className="p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {content.pages.intelligence.features.slice(0, 6).map((feature, index) => (
                  <div key={feature} className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-slate-200">
                    <CheckCircle2 size={16} className="mb-3 text-cyan-100" />
                    {feature}
                    <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-300" style={{ width: `${58 + index * 6}%` }} /></div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </ScrollScene3D>
        </div>
      </AnimatedSection>

      <AnimatedSection className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader eyebrow="Ölçülebilir sistem" title="Karar vermeyi kolaylaştıran anlaşılır performans görünümü" text="Teknik metrikler; işletme sahibinin ne olduğunu anlayabildiği, bir sonraki adımı görebildiği sade raporlara dönüşür." />
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            <AIInsightCard title="Potansiyel müşteri önceliği" text="Gelen taleplerin takip önceliği, müşteri yolculuğu ve görüşme notları birlikte değerlendirilir." />
            <GlassCard className="p-5"><AnimatedChart label="Kampanya performansı" /><p className="mt-4 text-sm leading-7 text-slate-300">Dönemsel değişimleri görün, optimizasyon kararlarını veriye göre şekillendirin.</p></GlassCard>
            <GlassCard className="p-5">
              <Layers3 className="text-amber-100" />
              <h3 className="mt-5 text-lg font-black text-white">CRM destekli takip</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">Potansiyel müşteriler, görüşme durumu ve takip notları dağınık ekranlarda kaybolmaz.</p>
              <Gauge className="mt-5 text-cyan-100" />
            </GlassCard>
          </div>
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

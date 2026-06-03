import type { Metadata } from "next";
import { BarChart3, BrainCircuit, CheckCircle2, Gauge, Layers3, Target } from "lucide-react";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { ButtonLink, PremiumCard, SectionHeader } from "@/components/public/ui";
import { PackageCards, ServiceGrid } from "@/components/public/ServicePackageSections";
import { PublicShell } from "@/components/public/Shell";
import {
  AIInsightCard,
  AnimatedBarChart,
  AnimatedChart,
  AnimatedFunnel,
  GlassCard,
  PremiumAnimatedHero,
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
      <PremiumAnimatedHero
        headline={home.headline}
        subheadline={home.subheadline}
        primaryCta={<ButtonLink href="/teklif-al">{home.primaryCta}</ButtonLink>}
        secondaryCta={<ButtonLink href="/paketler" variant="ghost">{home.secondaryCta}</ButtonLink>}
      />

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
        <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[.9fr_1.1fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[.22em] text-amber-100">Problemden sisteme</p>
            <h2 className="mt-5 text-3xl font-black leading-tight text-white sm:text-5xl">Dağınık reklam kararlarını tek bir büyüme akışına çevirin.</h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-300">Meta Ads, Google Ads, sosyal medya içerikleri ve CRM takipleri birbirinden kopuk olduğunda fırsatlar görünmez olur. HK Dijital bu parçaları ölçülebilir bir işletme ekranında birleştirir.</p>
          </div>
          <ScrollScene3D>
            <GlassCard className="p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_.75fr]">
                <div>
                  <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-100">Kanal sinyalleri</p>
                  <AnimatedBarChart />
                </div>
                <div>
                  <p className="mb-4 text-xs font-black uppercase tracking-[.16em] text-amber-100">Funnel akışı</p>
                  <AnimatedFunnel />
                </div>
              </div>
            </GlassCard>
          </ScrollScene3D>
        </div>
      </AnimatedSection>

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

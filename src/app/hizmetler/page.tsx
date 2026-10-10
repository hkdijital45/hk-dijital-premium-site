import type { Metadata } from "next";
import Link from "next/link";
import { Compass, FileSearch2, ClipboardCheck, Rocket, Zap, LineChart, Sparkles, type LucideIcon } from "lucide-react";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { serviceIcons } from "@/lib/icons";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard, MarketingPageHero, MarketingReveal, MarketingSection } from "@/components/public/marketing/MarketingUI";
import { MarketingCTA, MarketingNetworkBackground, ServiceVisual } from "@/components/public/marketing/MarketingVisualSystem";
import { serviceVisualVariantForKey } from "@/components/public/marketing/serviceVisualVariant";
import { servicePages } from "@/lib/public-seo-content";

// Moved here from the homepage (2026-10-11 IA simplification, Phase 4):
// this was the homepage's only "Nasıl Çalışıyoruz" content and had no
// other page of its own — this is its one real home now. Header.tsx's
// nav link points at #surec below.
const processSteps: Array<{ label: string; text: string; Icon: LucideIcon }> = [
  { label: "Analiz", text: "İşletme, hedef kitle ve mevcut dijital varlıklar birlikte değerlendirilir.", Icon: FileSearch2 },
  { label: "Strateji", text: "Kanal, bütçe ve mesaj önceliği hedefe göre netleştirilir.", Icon: Compass },
  { label: "Kurulum", text: "Kampanya, ölçümleme ve içerik altyapısı devreye alınır.", Icon: ClipboardCheck },
  { label: "Yayın", text: "Reklam ve içerikler planlanan takvimle yayına çıkar.", Icon: Rocket },
  { label: "Optimizasyon", text: "Sinyaller izlenir, bütçe ve kreatif buna göre ayarlanır.", Icon: Zap },
  { label: "Raporlama", text: "Sonuçlar anlaşılır bir dille, sade raporla paylaşılır.", Icon: LineChart },
  { label: "Büyüme", text: "Öğrenilenler bir sonraki döneme aksiyon olarak taşınır.", Icon: Sparkles }
];

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("services");
}

export default async function ServicesPage() {
  const content = await getSiteContent();

  return (
    <PublicShell>
      <div className="marketing-shell">
        <MarketingPageHero eyebrow="Hizmetler" title="Manisa Dijital Pazarlama Hizmetleri" text="Meta reklam yönetimi, Google Ads, sosyal medya stratejisi, dönüşüm takibi ve anlaşılır raporlamayı işletmenizin hedeflerine göre planlayın." visual={<MarketingNetworkBackground />} />
        <MarketingSection>
          <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:px-8">
            <MarketingReveal>
              <MarketingCard className="p-7">
                <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Öne çıkan hizmet sayfaları</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>Hizmet kapsamını, kimler için uygun olduğunu ve çalışma sürecini detaylı inceleyin.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {servicePages.map((service) => (
                    <Link key={service.slug} href={`/hizmetler/${service.slug}`} className="rounded-full border px-4 py-2 text-sm font-black transition hover:text-white hover:bg-[#107C73]" style={{ borderColor: "var(--mk-border-strong)", color: "var(--mk-violet)" }}>
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
                          <ServiceVisual variant={serviceVisualVariantForKey(service.id)} className="mt-5" />
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
            <MarketingReveal>
              <section id="surec" className="scroll-mt-28 rounded-[28px] p-7 sm:p-10" style={{ background: "#07111B" }}>
                <p className="marketing-eyebrow" style={{ color: "#23D9CE" }}>Nasıl Çalışıyoruz</p>
                <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">Keşiften Rapora Kadar</h2>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {processSteps.map((step, index) => (
                    <div key={step.label} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-white">{index + 1}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <step.Icon size={15} className="text-[#23D9CE]" />
                          <h3 className="text-sm font-black text-white">{step.label}</h3>
                        </div>
                        <p className="mt-1.5 text-xs leading-6 text-slate-400">{step.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </MarketingReveal>
            <MarketingReveal>
              <MarketingCTA
                title="Hangi hizmetin işletmenize uygun olduğundan emin değil misiniz?"
                text="Kısa bir ön görüşmeyle hedefinize göre doğru kanal ve kapsamı birlikte netleştirelim."
                trackingPrefix="Hizmetler Sayfası"
              />
            </MarketingReveal>
          </div>
        </MarketingSection>
      </div>
    </PublicShell>
  );
}

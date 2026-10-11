import type { Metadata } from "next";
import { CheckCircle2, Gauge, Sparkles, Users } from "lucide-react";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard, MarketingEyebrow, MarketingHeading, MarketingPageHero, MarketingReveal, MarketingSection } from "@/components/public/marketing/MarketingUI";
import { MarketingCTA, MarketingCTASection } from "@/components/public/marketing/MarketingVisualSystem";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("intelligence");
}

// HK Intelligence's 12 real features (content.pages.intelligence.features,
// admin-editable, nothing invented here) grouped into the 3 real stages of
// the system its own description already names — takip, analiz, hazırlık —
// so the page reads as a product hierarchy instead of one flat undifferentiated
// grid. Grouping is purely presentational (which heading a feature sits
// under); the feature text itself is never altered.
const FEATURE_GROUPS = [
  {
    title: "Takip ve İlişki Yönetimi",
    Icon: Users,
    description: "Potansiyel müşteri kayıtları, görüşme notları ve teklif süreci tek yerde, kontrollü şekilde ilerler.",
    match: ["Müşteri ilişki yönetimi ile düzenli takip", "Potansiyel müşteri önceliklendirmesi", "Müşteri takip notları", "Teklif ve görüşme süreci takibi"]
  },
  {
    title: "Analiz ve Skorlama",
    Icon: Gauge,
    description: "Dijital olgunluk, reklam hazırlığı ve bütçe kararları için yapay zekâ destekli analiz katmanı.",
    match: ["Yapay zekâ destekli dijital olgunluk skoru", "Reklam potansiyeli analizi", "Müşteri yolculuğu eksikleri analizi", "Bütçe öneri sistemi"]
  },
  {
    title: "Hazırlık ve İçerik",
    Icon: Sparkles,
    description: "Ön değerlendirme ve teklif hazırlığını içerik/kampanya fikirleriyle destekleyen üretim katmanı.",
    match: ["Ön değerlendirme raporu", "Yapay zekâ destekli teklif hazırlama", "İçerik önerileri", "Kampanya fikirleri"]
  }
] as const;

export default async function IntelligencePage() {
  const content = await getSiteContent();
  const page = content.pages.intelligence;

  // Any feature not matched by a group (e.g. an admin adds a 13th item
  // later) still renders — grouped under its own fallback section rather
  // than silently disappearing.
  const matchedFeatures = new Set(FEATURE_GROUPS.flatMap((group) => group.match as readonly string[]));
  const unmatchedFeatures = page.features.filter((feature) => !matchedFeatures.has(feature));

  return (
    <PublicShell>
      <div className="marketing-shell">
        <MarketingPageHero eyebrow="HK Intelligence" title={page.title} text={page.content} />

        {FEATURE_GROUPS.map((group) => {
          const items = page.features.filter((feature) => (group.match as readonly string[]).includes(feature));
          if (!items.length) return null;
          return (
            <MarketingSection key={group.title}>
              <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                <MarketingReveal>
                  <div className="flex items-start gap-4">
                    <div className="grid size-12 shrink-0 place-items-center rounded-xl" style={{ background: "var(--mk-bg-alt)", color: "#107C73" }}>
                      <group.Icon size={22} />
                    </div>
                    <div>
                      <MarketingEyebrow>{group.title}</MarketingEyebrow>
                      <p className="mt-2 max-w-xl text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{group.description}</p>
                    </div>
                  </div>
                  <MarketingCard className="mt-6 grid gap-3 p-6 sm:grid-cols-2">
                    {items.map((item) => (
                      <div key={item} className="flex items-start gap-2.5">
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: "#23D9CE" }} />
                        <span className="text-sm font-bold leading-6" style={{ color: "var(--mk-ink)" }}>{item}</span>
                      </div>
                    ))}
                  </MarketingCard>
                </MarketingReveal>
              </div>
            </MarketingSection>
          );
        })}

        {unmatchedFeatures.length > 0 && (
          <MarketingSection>
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
              <MarketingHeading as="h2" className="text-2xl">Diğer Özellikler</MarketingHeading>
              <MarketingCard className="mt-6 grid gap-3 p-6 sm:grid-cols-2">
                {unmatchedFeatures.map((item) => (
                  <div key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: "#23D9CE" }} />
                    <span className="text-sm font-bold leading-6" style={{ color: "var(--mk-ink)" }}>{item}</span>
                  </div>
                ))}
              </MarketingCard>
            </div>
          </MarketingSection>
        )}

        <MarketingSection>
          <MarketingCTASection>
            <MarketingCTA
              title="HK Intelligence ile stratejinizi görüşelim"
              text="Sonuç garantisi vermeyiz — daha net strateji, daha iyi takip ve daha şeffaf karar alma zemini kurarız."
              trackingPrefix="HK Intelligence"
            />
          </MarketingCTASection>
        </MarketingSection>
      </div>
    </PublicShell>
  );
}

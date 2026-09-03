import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard, MarketingPageHero, MarketingReveal, MarketingSection } from "@/components/public/marketing/MarketingUI";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("intelligence");
}

export default async function IntelligencePage() {
  const content = await getSiteContent();
  const page = content.pages.intelligence;

  return (
    <PublicShell>
      <div className="marketing-shell">
        <MarketingPageHero eyebrow="HK Intelligence" title={page.title} text={page.content} />
        <MarketingSection>
          <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
            {page.features.map((feature, index) => (
              <MarketingReveal key={feature} delay={index * 0.03}>
                <MarketingCard className="p-6">
                  <BrainCircuit className="text-[#7c3aed]" />
                  <h2 className="mt-5 text-xl font-black" style={{ color: "var(--mk-ink)" }}>{feature}</h2>
                  <p className="mt-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>
                    HK Intelligence bu başlığı stratejik karar sürecine destek olacak şekilde analiz eder ve reklam danışmanlığı akışına bağlar.
                  </p>
                </MarketingCard>
              </MarketingReveal>
            ))}
          </div>
        </MarketingSection>
      </div>
    </PublicShell>
  );
}

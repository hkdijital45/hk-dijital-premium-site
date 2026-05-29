import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("intelligence");
}

export default async function IntelligencePage() {
  const content = await getSiteContent();
  const page = content.pages.intelligence;

  return (
    <PublicShell>
      <PageHero eyebrow="HK Intelligence" title={page.title} text={page.content} />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-2 lg:grid-cols-3">
          {page.features.map((feature) => (
            <PremiumCard key={feature}>
              <BrainCircuit className="text-cyan-200" />
              <h2 className="mt-5 text-xl font-black text-white">{feature}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                HK Intelligence bu başlığı stratejik karar sürecine destek olacak şekilde analiz eder ve reklam danışmanlığı akışına bağlar.
              </p>
            </PremiumCard>
          ))}
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

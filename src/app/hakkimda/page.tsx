import type { Metadata } from "next";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("about");
}

export default async function AboutPage() {
  const content = await getSiteContent();
  const about = content.pages.about;

  return (
    <PublicShell>
      <PageHero eyebrow="Hakkımda" title={about.title} text="Dijital pazarlama uzmanı yaklaşımıyla, reklam danışmanlığı ve süreç yönetimini aynı disiplin içinde ele alan premium bir çalışma modeli." />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_.85fr]">
          <PremiumCard>
            <h1 className="text-3xl font-black text-white">Hayri Kamalı</h1>
            <p className="mt-5 text-base leading-8 text-slate-300">{about.content}</p>
          </PremiumCard>
          <div className="grid gap-4">
            {about.highlights.map((item) => (
              <PremiumCard key={item}>
                <h2 className="text-lg font-black text-cyan-100">{item}</h2>
              </PremiumCard>
            ))}
          </div>
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

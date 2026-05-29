import type { Metadata } from "next";
import { getSiteContent, disclaimerText } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { PackageCards } from "@/components/public/ServicePackageSections";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("packages");
}

export default async function PackagesPage() {
  const content = await getSiteContent();

  return (
    <PublicShell>
      <PageHero eyebrow="Paketler" title="Dijital reklam yönetimi için gerçekçi ve ölçeklenebilir paketler" text={content.pages.packages.intro} />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <PackageCards packages={content.packages} />
          <PremiumCard className="mt-8">
            <h2 className="text-xl font-black text-white">Önemli bilgilendirme</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">{disclaimerText}</p>
          </PremiumCard>
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

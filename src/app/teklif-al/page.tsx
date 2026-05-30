import type { Metadata } from "next";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { PublicShell } from "@/components/public/Shell";
import { QuoteWizard } from "@/components/public/QuoteWizard";
import { PageHero } from "@/components/public/ui";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("quote");
}

export default async function QuotePage() {
  const content = await getSiteContent();

  return (
    <PublicShell>
      <PageHero eyebrow="Paket Öneri Robotu" title={content.quoteWizard.title} text={content.quoteWizard.subtitle} />
      <section className="px-4 pb-24 sm:px-6 lg:px-8">
        <QuoteWizard content={{ quoteWizard: content.quoteWizard, packages: content.packages, contact: content.contact }} />
      </section>
    </PublicShell>
  );
}

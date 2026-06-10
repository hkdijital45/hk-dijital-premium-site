import type { Metadata } from "next";
import Link from "next/link";
import { Award, FileText } from "lucide-react";
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
        <div id="sertifikalar" className="mx-auto mt-12 max-w-7xl scroll-mt-28">
          <div className="mb-6">
            <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-200">Sertifikalar</p>
            <h2 className="mt-3 text-2xl font-black text-white">{content.pages.certificates.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{content.pages.certificates.intro}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {content.certificates
              .filter((certificate) => certificate.visible)
              .sort((a, b) => a.order - b.order)
              .map((certificate) => (
                <PremiumCard key={certificate.id}>
                  <div className="grid size-12 place-items-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-200">
                    {certificate.fileUrl ? <FileText /> : <Award />}
                  </div>
                  <h3 className="mt-5 text-xl font-black text-white">{certificate.title}</h3>
                  <p className="mt-2 text-sm font-bold text-cyan-100">{certificate.institution} · {certificate.date}</p>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{certificate.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {certificate.fileUrl && <Link href={certificate.fileUrl} target="_blank" className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white">Dosyayı Gör</Link>}
                    {certificate.verificationUrl && <Link href={certificate.verificationUrl} target="_blank" className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Doğrula</Link>}
                  </div>
                </PremiumCard>
              ))}
          </div>
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";
import { absoluteUrl, pageMetadata } from "@/lib/metadata";
import { caseStudies } from "@/lib/public-seo-content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("works");
}

export default function WorksPage() {
  return (
    <PublicShell>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Çalışmalarımız", item: absoluteUrl("/calismalarimiz") }
        ]
      }} />
      <PageHero
        eyebrow="Çalışmalarımız"
        title="Gerçekçi Kapsamla Anlatılan Dijital Pazarlama Çalışmaları"
        text="Paylaşılabilir müşteri verisi olmayan çalışmalarda sahte sonuç üretmiyoruz. Örnekleri sektör, ihtiyaç, yaklaşım ve teslim edilen çalışmalar üzerinden anonim biçimde sunuyoruz."
      />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6">
          {caseStudies.map((study) => (
            <PremiumCard key={study.title}>
              <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr]">
                <div>
                  <BriefcaseBusiness className="text-cyan-200" size={32} />
                  <p className="mt-5 text-sm font-black uppercase tracking-[.18em] text-cyan-200">{study.sector}</p>
                  <h2 className="mt-3 text-3xl font-black text-white">{study.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-slate-300">{study.need}</p>
                </div>
                <div className="grid gap-5">
                  <div>
                    <h3 className="font-black text-cyan-100">Uygulanan yaklaşım</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{study.approach}</p>
                  </div>
                  <div>
                    <h3 className="font-black text-cyan-100">Kullanılan hizmetler</h3>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {study.services.map((item) => <span key={item} className="rounded-full bg-cyan-200/10 px-3 py-2 text-xs font-black text-cyan-100">{item}</span>)}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-black text-cyan-100">Teslim edilen çalışmalar</h3>
                    <ul className="mt-3 grid gap-2 text-sm text-slate-300">
                      {study.delivery.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            </PremiumCard>
          ))}
          <PremiumCard className="border-amber-200/20 bg-amber-200/[0.06]">
            <h2 className="text-2xl font-black text-white">Sizin işletmeniz için nasıl bir çalışma gerekir?</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Ön görüşmede sektör, hizmet alanı, reklam hedefi ve mevcut dijital varlıklar değerlendirilir. Kesin başarı vaadi yerine uygulanabilir yol haritası çıkarılır.</p>
            <Link href="/teklif-al" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-black text-slate-950 transition hover:bg-cyan-200">Ücretsiz ön görüşme al</Link>
          </PremiumCard>
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";
import { absoluteUrl, pageMetadata } from "@/lib/metadata";
import { servicePages } from "@/lib/public-seo-content";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return servicePages.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = servicePages.find((item) => item.slug === slug);
  if (!service) return pageMetadata("services");
  return pageMetadata(service.key, { alternates: { canonical: `/hizmetler/${service.slug}` } });
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = servicePages.find((item) => item.slug === slug);
  if (!service) notFound();
  const Icon = service.icon;

  return (
    <PublicShell>
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Hizmetler", item: absoluteUrl("/hizmetler") },
            { "@type": "ListItem", position: 3, name: service.eyebrow, item: absoluteUrl(`/hizmetler/${service.slug}`) }
          ]
        },
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: service.eyebrow,
          description: service.description,
          areaServed: ["Manisa", "Türkiye"],
          provider: {
            "@type": "Organization",
            name: "HK Dijital",
            url: absoluteUrl("/")
          }
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: service.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer }
          }))
        }
      ]} />
      <PageHero eyebrow={service.eyebrow} title={service.title} text={service.description} />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[.75fr_1.25fr]">
          <PremiumCard>
            <div className="grid size-14 place-items-center rounded-[14px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
              <Icon size={28} />
            </div>
            <h2 className="mt-6 text-2xl font-black text-white">Kimler için uygun?</h2>
            <ul className="mt-5 grid gap-3 text-sm leading-7 text-slate-300">
              {service.audience.map((item) => <li key={item} className="flex gap-3"><CheckCircle2 className="mt-1 shrink-0 text-cyan-200" size={17} />{item}</li>)}
            </ul>
            <Link href="/teklif-al" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-300 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-200">Ücretsiz ön görüşme al</Link>
          </PremiumCard>
          <div className="grid gap-6">
            <PremiumCard>
              <h2 className="text-2xl font-black text-white">Hangi problemleri çözer?</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {service.problems.map((item) => <div key={item} className="rounded-[14px] border border-white/10 bg-white/[0.045] p-4 text-sm leading-6 text-slate-300">{item}</div>)}
              </div>
            </PremiumCard>
            <PremiumCard>
              <h2 className="text-2xl font-black text-white">Hizmete neler dahil?</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {service.included.map((item) => <div key={item} className="rounded-[14px] bg-cyan-200/10 px-4 py-3 text-sm font-bold text-cyan-50">{item}</div>)}
              </div>
            </PremiumCard>
            <PremiumCard>
              <h2 className="text-2xl font-black text-white">Çalışma süreci</h2>
              <div className="mt-5 grid gap-3">
                {service.process.map((item, index) => (
                  <div key={item} className="grid gap-3 rounded-[14px] border border-white/10 bg-black/20 p-4 sm:grid-cols-[42px_1fr]">
                    <span className="grid size-10 place-items-center rounded-full bg-cyan-300 text-sm font-black text-slate-950">{index + 1}</span>
                    <p className="text-sm leading-7 text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </PremiumCard>
            <PremiumCard>
              <h2 className="text-2xl font-black text-white">Manisa yerel bağlantısı</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">HK Dijital Manisa merkezlidir. Şehzadeler, Yunusemre, Akhisar, Turgutlu, Salihli, Soma, Alaşehir ve Saruhanlı dahil Manisa merkez ve ilçelerindeki işletmelerin reklam, sosyal medya ve ölçümleme ihtiyaçları yerel hizmet alanına göre değerlendirilir.</p>
            </PremiumCard>
            <PremiumCard>
              <h2 className="text-2xl font-black text-white">Sık sorulan sorular</h2>
              <div className="mt-5 grid gap-4">
                {service.faq.map((item) => (
                  <div key={item.question} className="rounded-[14px] border border-white/10 bg-white/[0.04] p-4">
                    <h3 className="font-black text-cyan-100">{item.question}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{item.answer}</p>
                  </div>
                ))}
              </div>
            </PremiumCard>
            <PremiumCard>
              <h2 className="text-xl font-black text-white">İlgili hizmetler</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {service.related.map((item) => <Link key={item.href} href={item.href} className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-200 hover:text-slate-950">{item.label}</Link>)}
              </div>
            </PremiumCard>
          </div>
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

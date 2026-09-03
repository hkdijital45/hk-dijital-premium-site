import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard, MarketingPageHero, MarketingReveal, MarketingSection } from "@/components/public/marketing/MarketingUI";
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
          provider: { "@type": "Organization", name: "HK Dijital", url: absoluteUrl("/") }
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: service.faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } }))
        }
      ]} />
      <div className="marketing-shell">
        <MarketingPageHero eyebrow={service.eyebrow} title={service.title} text={service.description} />
        <MarketingSection>
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[.75fr_1.25fr] lg:px-8">
            <MarketingReveal>
              <MarketingCard className="p-7">
                <div className="grid size-14 place-items-center rounded-2xl" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-violet)" }}>
                  <Icon size={28} />
                </div>
                <h2 className="mt-6 text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Kimler için uygun?</h2>
                <ul className="mt-5 grid gap-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>
                  {service.audience.map((item) => <li key={item} className="flex gap-3"><CheckCircle2 className="mt-1 shrink-0 text-[#7c3aed]" size={17} />{item}</li>)}
                </ul>
                <Link href="/teklif-al" className="marketing-btn marketing-btn-primary mt-7">Ücretsiz ön görüşme al</Link>
              </MarketingCard>
            </MarketingReveal>
            <div className="grid gap-6">
              <MarketingReveal>
                <MarketingCard className="p-7">
                  <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Hangi problemleri çözer?</h2>
                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {service.problems.map((item) => <div key={item} className="rounded-xl border p-4 text-sm leading-6" style={{ borderColor: "var(--mk-border)", color: "var(--mk-ink-soft)" }}>{item}</div>)}
                  </div>
                </MarketingCard>
              </MarketingReveal>
              <MarketingReveal delay={0.05}>
                <MarketingCard className="p-7">
                  <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Hizmete neler dahil?</h2>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {service.included.map((item) => <div key={item} className="rounded-xl px-4 py-3 text-sm font-bold" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-ink)" }}>{item}</div>)}
                  </div>
                </MarketingCard>
              </MarketingReveal>
              <MarketingReveal delay={0.1}>
                <MarketingCard className="p-7">
                  <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Çalışma süreci</h2>
                  <div className="mt-5 grid gap-3">
                    {service.process.map((item, index) => (
                      <div key={item} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[42px_1fr]" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }}>
                        <span className="grid size-10 place-items-center rounded-full text-sm font-black text-white" style={{ background: "var(--mk-violet)" }}>{index + 1}</span>
                        <p className="text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{item}</p>
                      </div>
                    ))}
                  </div>
                </MarketingCard>
              </MarketingReveal>
              <MarketingCard className="p-7">
                <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Manisa yerel bağlantısı</h2>
                <p className="mt-4 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>HK Dijital Manisa merkezlidir. Şehzadeler, Yunusemre, Akhisar, Turgutlu, Salihli, Soma, Alaşehir ve Saruhanlı dahil Manisa merkez ve ilçelerindeki işletmelerin reklam, sosyal medya ve ölçümleme ihtiyaçları yerel hizmet alanına göre değerlendirilir.</p>
              </MarketingCard>
              <MarketingCard className="p-7">
                <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Sık sorulan sorular</h2>
                <div className="mt-5 grid gap-4">
                  {service.faq.map((item) => (
                    <div key={item.question} className="rounded-xl border p-4" style={{ borderColor: "var(--mk-border)" }}>
                      <h3 className="font-black" style={{ color: "var(--mk-violet)" }}>{item.question}</h3>
                      <p className="mt-2 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{item.answer}</p>
                    </div>
                  ))}
                </div>
              </MarketingCard>
              <MarketingCard className="p-7">
                <h2 className="text-xl font-black" style={{ color: "var(--mk-ink)" }}>İlgili hizmetler</h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {service.related.map((item) => <Link key={item.href} href={item.href} className="rounded-full border px-4 py-2 text-sm font-black transition hover:bg-[#7c3aed] hover:text-white" style={{ borderColor: "var(--mk-border-strong)", color: "var(--mk-violet)" }}>{item.label}</Link>)}
                </div>
              </MarketingCard>
            </div>
          </div>
        </MarketingSection>
      </div>
    </PublicShell>
  );
}

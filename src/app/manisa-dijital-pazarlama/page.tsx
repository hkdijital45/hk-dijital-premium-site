import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Target } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";
import { absoluteUrl, pageMetadata } from "@/lib/metadata";
import { localSeoFaq, serviceOverviewCards } from "@/lib/public-seo-content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("manisa");
}

export default function ManisaDigitalMarketingPage() {
  const districts = ["Şehzadeler", "Yunusemre", "Akhisar", "Turgutlu", "Salihli", "Soma", "Alaşehir", "Saruhanlı"];

  return (
    <PublicShell>
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Manisa Dijital Pazarlama", item: absoluteUrl("/manisa-dijital-pazarlama") }
          ]
        },
        {
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: "HK Dijital",
          url: absoluteUrl("/manisa-dijital-pazarlama"),
          areaServed: ["Manisa", ...districts, "Türkiye"],
          address: { "@type": "PostalAddress", addressLocality: "Manisa", addressCountry: "TR" },
          description: "Manisa merkezli dijital pazarlama, Meta reklam yönetimi, Google Ads ve sosyal medya stratejisi hizmetleri."
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: localSeoFaq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer }
          }))
        }
      ]} />
      <PageHero
        eyebrow="Manisa Dijital Pazarlama Ajansı"
        title="Manisa’daki İşletmeler İçin Ölçülebilir Reklam ve Dijital Pazarlama"
        text="HK Dijital; Manisa merkezli işletmelerin Meta reklamları, Google Ads, sosyal medya stratejisi, dönüşüm takibi ve performans raporlamasını daha anlaşılır hale getirir."
      />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6">
          <PremiumCard>
            <h2 className="text-3xl font-black text-white">Manisa’daki işletmeler için dijital pazarlama neden önemli?</h2>
            <p className="mt-4 text-base leading-8 text-slate-300">Yerel rekabet yalnız tabela, konum veya tavsiye ile sınırlı değil. Kullanıcılar Instagram’da keşfediyor, Google’da arıyor, yorumlara bakıyor ve çoğu zaman WhatsApp veya form üzerinden ilk teması kuruyor. Bu yüzden reklam, sosyal medya ve takip altyapısı birlikte planlanmalıdır.</p>
          </PremiumCard>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {serviceOverviewCards.map((service) => {
              const Icon = service.icon;
              return (
                <Link key={service.href} href={service.href} className="impact-card glass-card block p-6 transition hover:-translate-y-1 hover:border-cyan-200/25">
                  <Icon className="text-cyan-200" size={28} />
                  <h2 className="mt-5 text-xl font-black text-white">{service.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{service.text}</p>
                </Link>
              );
            })}
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_.9fr]">
            <PremiumCard>
              <Target className="text-cyan-200" size={30} />
              <h2 className="mt-5 text-2xl font-black text-white">HK Dijital’in çalışma süreci</h2>
              <div className="mt-5 grid gap-3">
                {["Keşif ve hedef netleştirme", "Kanal ve bütçe önceliği", "Kampanya kurulumu ve dönüşüm takibi", "Düzenli optimizasyon", "Anlaşılır performans raporu"].map((item, index) => (
                  <div key={item} className="flex gap-3 rounded-[14px] border border-white/10 bg-white/[0.04] p-4 text-sm font-bold text-slate-200">
                    <span className="text-cyan-200">0{index + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
            </PremiumCard>
            <PremiumCard>
              <MapPin className="text-amber-200" size={30} />
              <h2 className="mt-5 text-2xl font-black text-white">Manisa ve ilçelerine hizmet yaklaşımı</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">Manisa merkez ve ilçelerindeki işletmeler için lokasyon, hizmet alanı ve rekabet durumu dikkate alınır. Her ilçe için ayrı ince sayfalar yerine, hizmet ihtiyacına göre tek ve doğru strateji oluşturulur.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {districts.map((district) => <span key={district} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black text-slate-200">{district}</span>)}
              </div>
            </PremiumCard>
          </div>
          <PremiumCard>
            <h2 className="text-2xl font-black text-white">Hizmet verilen işletme türleri</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {["Yerel hizmet işletmeleri", "Klinik ve danışmanlık yapıları", "Mağaza, e-ticaret ve kişisel markalar"].map((item) => (
                <div key={item} className="rounded-[14px] border border-cyan-200/15 bg-cyan-200/[0.055] p-4 text-sm font-bold text-cyan-50">{item}</div>
              ))}
            </div>
          </PremiumCard>
          <PremiumCard>
            <h2 className="text-2xl font-black text-white">Sık sorulan sorular</h2>
            <div className="mt-5 grid gap-4">
              {localSeoFaq.map((item) => (
                <div key={item.question} className="rounded-[14px] border border-white/10 bg-white/[0.04] p-4">
                  <h3 className="font-black text-cyan-100">{item.question}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-300">{item.answer}</p>
                </div>
              ))}
            </div>
          </PremiumCard>
          <PremiumCard className="border-cyan-200/25 bg-cyan-200/[0.08]">
            <h2 className="text-3xl font-black text-white">Manisa dijital pazarlama çalışmanızı birlikte netleştirelim.</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">Kısa bir ön görüşmeyle işletmenizin hedefi, uygun reklam kanalı, ölçümleme ihtiyacı ve ilk 30 günlük yol haritası değerlendirilebilir.</p>
            <Link href="/teklif-al" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-black text-slate-950 transition hover:bg-cyan-200">Ücretsiz ön görüşme al</Link>
          </PremiumCard>
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

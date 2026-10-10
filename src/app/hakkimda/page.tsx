import type { Metadata } from "next";
import Link from "next/link";
import { Award, Compass, FileText, Handshake, LineChart, Map, MapPin, MessageCircle, ShieldCheck, Target, type LucideIcon } from "lucide-react";
import { getSiteContent } from "@/lib/content";
import { absoluteUrl, pageMetadata } from "@/lib/metadata";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard, MarketingPageHero, MarketingReveal, MarketingSection } from "@/components/public/marketing/MarketingUI";
import { MarketingCTA, MarketingDashboardCard, MarketingNetworkBackground } from "@/components/public/marketing/MarketingVisualSystem";

// Moved here from the homepage (2026-10-11 IA simplification, Phase 4):
// this was the homepage's "Neden HK Dijital" trust section — About is its
// natural home (replaces the two overlapping one-off cards this page
// already had, "Manisa merkezli çalışma"/"Ölçüm ve şeffaflık", which said
// the same thing as two of these six points).
const whyHkPoints: Array<{ title: string; text: string; Icon: LucideIcon }> = [
  { title: "Yerel bilgi", text: "Manisa ve ilçelerindeki işletme dinamiklerini yakından tanıyan bir ajans deneyimi.", Icon: Map },
  { title: "Kişisel ilgi", text: "Her hesap toplu bir şablon değil, kendi hedefine göre yönetilen ayrı bir çalışma olarak ele alınır.", Icon: Handshake },
  { title: "Şeffaf iletişim", text: "Bütçe, kapsam ve beklenti başında netleşir; süreç boyunca aynı netlikte iletişim sürer.", Icon: MessageCircle },
  { title: "Veri odaklı yaklaşım", text: "Kararlar izlenime değil, ölçülen sinyale — tıklama, mesaj, form, maliyet — dayanır.", Icon: LineChart },
  { title: "Önce strateji, sonra reklam", text: "Bütçe yayına çıkmadan önce hedef, teklif ve kanal uyumu netleştirilir.", Icon: Compass },
  { title: "Gerçekçi beklenti", text: "Satış garantisi verilmez; ölçülebilir bir büyüme sistemi kurulur ve işletilir.", Icon: ShieldCheck }
];

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("about");
}

export default async function AboutPage() {
  const content = await getSiteContent();
  const about = content.pages.about;

  return (
    <PublicShell>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Hakkımızda", item: absoluteUrl("/hakkimda") }
        ]
      }} />
      <div className="marketing-shell">
        <MarketingPageHero eyebrow="Hakkımızda" title="HK Dijital: Manisa Merkezli Dijital Pazarlama ve Reklam Danışmanlığı" text="Hayri Kamalı tarafından kurulan HK Dijital; reklam yönetimi, sosyal medya stratejisi, ölçümleme ve şeffaf raporlama yaklaşımıyla Manisa’dan Türkiye geneline hizmet verir." visual={<MarketingNetworkBackground />} />
        <MarketingSection>
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_.85fr] lg:px-8">
            <MarketingReveal>
              <MarketingCard feature className="p-8">
                <h2 className="text-3xl font-black" style={{ color: "var(--mk-ink)" }}>Hayri Kamalı ve HK Dijital yaklaşımı</h2>
                <p className="mt-5 text-base leading-8" style={{ color: "var(--mk-ink-soft)" }}>{about.content}</p>
                <p className="mt-5 text-base leading-8" style={{ color: "var(--mk-ink-soft)" }}>Çalışma modeli Manisa merkezli yerel pazar bilgisini, Türkiye geneline uzaktan hizmet verebilen dijital reklam ve ölçümleme disipliniyle birleştirir. Satış garantisi verilmez; hedef, veri, optimizasyon ve raporlama süreci şeffaf biçimde yönetilir.</p>
                <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MarketingDashboardCard icon={<MapPin size={16} />} label="Merkez" value="Manisa" />
                  <MarketingDashboardCard icon={<ShieldCheck size={16} />} label="Yaklaşım" value="Veri odaklı" />
                  <MarketingDashboardCard icon={<Target size={16} />} label="Kapsam" value="Türkiye geneli" />
                  <MarketingDashboardCard icon={<Award size={16} />} label="Model" value="Şeffaf rapor" />
                </div>
              </MarketingCard>
            </MarketingReveal>
            <div className="grid gap-4">
              {about.highlights.map((item) => (
                <MarketingCard key={item} className="p-6">
                  <h2 className="text-lg font-black" style={{ color: "var(--mk-ink)" }}>{item}</h2>
                </MarketingCard>
              ))}
            </div>
          </div>
          <div className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
            <MarketingReveal>
              <p className="marketing-eyebrow">Neden HK Dijital</p>
              <h2 className="mt-3 text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Deneyim ve şeffaflık</h2>
            </MarketingReveal>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {whyHkPoints.map((point) => (
                <MarketingCard key={point.title} className="p-6">
                  <point.Icon size={22} className="text-[#107C73]" />
                  <h3 className="mt-4 text-lg font-black" style={{ color: "var(--mk-ink)" }}>{point.title}</h3>
                  <p className="mt-2 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{point.text}</p>
                </MarketingCard>
              ))}
            </div>
          </div>
          <div id="sertifikalar" className="mx-auto mt-12 max-w-7xl scroll-mt-28 px-4 sm:px-6 lg:px-8">
            <MarketingReveal>
              <MarketingEyebrowBlock title={content.pages.certificates.title} intro={content.pages.certificates.intro} />
            </MarketingReveal>
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {content.certificates
                .filter((certificate) => certificate.visible)
                .sort((a, b) => a.order - b.order)
                .map((certificate) => (
                  <MarketingCard key={certificate.id} className="p-6">
                    <div className="grid size-12 place-items-center rounded-xl" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-violet)" }}>
                      {certificate.fileUrl ? <FileText /> : <Award />}
                    </div>
                    <h3 className="mt-5 text-xl font-black" style={{ color: "var(--mk-ink)" }}>{certificate.title}</h3>
                    <p className="mt-2 text-sm font-bold" style={{ color: "var(--mk-violet)" }}>{certificate.institution} · {certificate.date}</p>
                    <p className="mt-4 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{certificate.description}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {certificate.fileUrl && <Link href={certificate.fileUrl} target="_blank" rel="noopener noreferrer" className="marketing-btn marketing-btn-secondary">Dosyayı Gör</Link>}
                      {certificate.verificationUrl && <Link href={certificate.verificationUrl} target="_blank" rel="noopener noreferrer" className="marketing-btn marketing-btn-primary">Doğrula</Link>}
                    </div>
                  </MarketingCard>
                ))}
            </div>
          </div>
          <div className="mx-auto mt-12 max-w-7xl px-4 sm:px-6 lg:px-8">
            <MarketingReveal>
              <MarketingCTA
                title="HK Dijital ile çalışma şeklimizi bir görüşmede anlatalım"
                text="İşletmenizin hedefine göre hangi kanal ve kapsamın uygun olduğunu birlikte netleştirelim."
                trackingPrefix="Hakkımızda Sayfası"
              />
            </MarketingReveal>
          </div>
        </MarketingSection>
      </div>
    </PublicShell>
  );
}

function MarketingEyebrowBlock({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="mb-6">
      <p className="marketing-eyebrow">Sertifikalar</p>
      <h2 className="mt-3 text-2xl font-black" style={{ color: "var(--mk-ink)" }}>{title}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{intro}</p>
    </div>
  );
}

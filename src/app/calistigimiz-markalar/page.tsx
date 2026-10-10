import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, GitBranch, Handshake, Megaphone, Search, Share2 } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { MarketingEyebrow, MarketingReveal } from "@/components/public/marketing/MarketingUI";
import { absoluteUrl, pageMetadata } from "@/lib/metadata";
import { getActiveBrandShowcases } from "@/lib/brand-showcase-public";
import { getSiteContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("brands");
}

// Lime accent used ONLY for the service bullet squares and the final CTA —
// never a whole row/card background — scoped locally, not a global token.
const LIME = "#9ee635";

// HK Dijital's own fixed service lineup (agency copy, not brand data) — the
// same concepts already iconified across the site (serviceIcons in
// @/lib/icons.tsx), kept as a small local list since this exact 5-item
// capability strip doesn't exist as CMS content anywhere else.
const CAPABILITIES = [
  { icon: Megaphone, title: "Meta Ads", text: "Reklam Yönetimi" },
  { icon: Search, title: "Google Ads", text: "Dijital Görünürlük" },
  { icon: Share2, title: "Sosyal Medya", text: "İçerik & Yönetim" },
  { icon: GitBranch, title: "Dijital Strateji", text: "Büyüme Odaklı" },
  { icon: BarChart3, title: "Raporlama", text: "Veriye Dayalı Karar" }
];

// Presentation-only metadata, not business data: brand_showcases has no
// sector/location column and this task explicitly forbids a migration for
// display labels. Keyed by the real, current production brand names; an
// admin-added brand that isn't in this map simply shows no sector line
// (never a fabricated one). Tone is a soft, brand-appropriate background
// tint for the logo stage — the real logo file itself is never altered.
const BRAND_PRESENTATION: Record<string, { sector: string; tone: string }> = {
  "görke tasarım": { sector: "TASARIM & ÜRETİM • MANİSA", tone: "linear-gradient(135deg, #f7ead9, #efddbf)" },
  "genel sağlık-iş manisa şube": { sector: "SENDİKA • KURUMSAL İLETİŞİM", tone: "linear-gradient(135deg, #fde3e3, #f9ccd0)" },
  "saruhanlı eğitim ve kültür derneği": { sector: "STK • EĞİTİM & KÜLTÜR", tone: "linear-gradient(135deg, #fbe4e8, #f2e2e6)" },
  "my cake 45": { sector: "BUTİK PASTA • YEREL İŞLETME • MANİSA", tone: "linear-gradient(135deg, #faf1dc, #f4e2bd)" },
  "acn ilk yardım eğitim merkezi": { sector: "SAĞLIK • EĞİTİM • MANİSA", tone: "linear-gradient(135deg, #dcedfc, #bde1fa)" }
};
const DEFAULT_TONE = "linear-gradient(135deg, rgba(16, 124, 115,.08), rgba(35, 217, 206,.12))";

function presentationFor(name: string) {
  return BRAND_PRESENTATION[name.trim().toLocaleLowerCase("tr")];
}

export default async function BrandsPortfolioPage() {
  const [brands, content] = await Promise.all([getActiveBrandShowcases(), getSiteContent()]);
  const hkLogoUrl = content.brand.logoUrl || "/branding/hk-dijital-logo.png";
  const uniqueServiceCount = new Set(brands.flatMap((b) => b.services.map((s) => s.trim().toLocaleLowerCase("tr")))).size;
  const stats = [
    { value: `${brands.length}+`, label: "İş Birliği" },
    ...(uniqueServiceCount > 0 ? [{ value: `${uniqueServiceCount}+`, label: "Hizmet Alanı" }] : []),
    { value: "Manisa → Türkiye", label: "Hizmet Kapsamı" }
  ];

  return (
    <PublicShell>
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Çalıştığımız Markalar", item: absoluteUrl("/calistigimiz-markalar") }
          ]
        }
      ]} />
      <div className="marketing-shell">
        {/* ---------------------------------------------------------- HERO */}
        <section className="relative overflow-hidden border-b" style={{ borderColor: "var(--mk-border)" }}>
          <div className="marketing-glow" style={{ width: 420, height: 420, top: -160, left: "-8%", background: "rgba(16, 124, 115,.14)" }} aria-hidden="true" />
          <div className="marketing-glow" style={{ width: 320, height: 320, top: -80, right: "-6%", background: "rgba(35, 217, 206,.10)" }} aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8 lg:py-24">
            <MarketingReveal>
              <MarketingEyebrow>Markalar &amp; İş Birlikleri</MarketingEyebrow>
              <h1 className="mt-5 text-[clamp(2.1rem,4.5vw,3.25rem)] font-black leading-[1.08]" style={{ color: "var(--mk-ink)" }}>
                Birlikte Değer<br />Ürettiğimiz <span className="marketing-gradient-text">Markalar</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 sm:text-lg" style={{ color: "var(--mk-ink-soft)" }}>
                Farklı sektörlerdeki marka ve kurumların dijital süreçlerini strateji, reklam, sosyal medya ve teknoloji çözümleriyle veriye dayalı şekilde yönetiyoruz.
              </p>
              <div className="mt-9 flex flex-wrap gap-x-8 gap-y-5">
                {CAPABILITIES.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-[12px]" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-violet)" }} aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black leading-tight" style={{ color: "var(--mk-ink)" }}>{title}</span>
                      <span className="block text-xs font-semibold leading-tight" style={{ color: "var(--mk-ink-faint)" }}>{text}</span>
                    </span>
                  </div>
                ))}
              </div>
            </MarketingReveal>

            {/* Decorative hero object: the real HK Dijital logo (never
                recreated) on a dark premium tile, with soft brand-color
                shapes behind it — CSS only, no stock asset. */}
            <MarketingReveal delay={.1} className="relative hidden h-64 lg:block">
              <span aria-hidden className="absolute right-6 top-2 size-40 rotate-[10deg] rounded-[32px]" style={{ background: "linear-gradient(135deg, var(--mk-violet), var(--mk-indigo))", opacity: .9, boxShadow: "0 30px 60px rgba(13, 27, 40,.28)" }} />
              <span aria-hidden className="absolute right-24 top-32 size-28 -rotate-[8deg] rounded-[24px]" style={{ background: `linear-gradient(135deg, ${LIME}, #65a30d)`, opacity: .85, boxShadow: "0 20px 44px rgba(101,163,13,.22)" }} />
              <div className="absolute right-10 top-10 w-40 -rotate-3 rounded-[26px] p-5" style={{ background: "linear-gradient(160deg, #13141f, #1d2032)", boxShadow: "0 24px 48px rgba(15,16,36,.35)" }}>
                <div className="relative mx-auto aspect-square w-full">
                  <Image src={hkLogoUrl} alt="HK Dijital" fill sizes="160px" className="object-contain" unoptimized={!hkLogoUrl.startsWith("/")} />
                </div>
              </div>
            </MarketingReveal>
          </div>
        </section>

        {/* ------------------------------------------------------- CARDS */}
        <section className="py-16 sm:py-20" style={{ background: "var(--mk-bg-alt)" }}>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {brands.length === 0 ? (
              <MarketingReveal className="mx-auto max-w-xl">
                <div className="rounded-[20px] border px-6 py-16 text-center" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
                  <span className="mx-auto grid size-12 place-items-center rounded-full" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-violet)" }} aria-hidden="true">
                    <Handshake size={22} />
                  </span>
                  <p className="mt-4 text-lg font-black" style={{ color: "var(--mk-ink)" }}>Marka portföyümüz yakında burada.</p>
                </div>
              </MarketingReveal>
            ) : (
              <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:gap-8">
                {brands.map((brand, index) => {
                  const isLoneLast = brands.length % 2 === 1 && index === brands.length - 1;
                  const presentation = presentationFor(brand.name);
                  return (
                    <MarketingReveal key={brand.id} delay={Math.min(index, 5) * 0.05} className={isLoneLast ? "md:col-span-2" : ""}>
                      <article className="marketing-card group grid h-full overflow-hidden lg:grid-cols-[1.25fr_1fr]">
                        <div className="flex flex-col gap-5 p-7 sm:p-9">
                          <div>
                            <h2 className="min-w-0 break-words text-[clamp(1.25rem,1.6vw+1rem,1.75rem)] font-black leading-tight" style={{ color: "var(--mk-ink)" }}>{brand.name}</h2>
                            {presentation?.sector && (
                              <p className="mt-1.5 text-xs font-black uppercase tracking-[.1em]" style={{ color: "var(--mk-ink-faint)" }}>{presentation.sector}</p>
                            )}
                          </div>

                          {brand.services.length > 0 && (
                            <div>
                              <p className="text-xs font-black uppercase tracking-[.12em]" style={{ color: "var(--mk-ink-faint)" }}>İş Birliği Kapsamı</p>
                              <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                                {brand.services.map((service) => (
                                  <li key={service} className="flex items-center gap-2.5">
                                    <span className="size-[7px] shrink-0 rounded-[2px]" style={{ background: LIME, boxShadow: `0 0 6px rgba(35, 217, 206,.55)` }} aria-hidden="true" />
                                    <span className="text-[15px] font-semibold leading-6 sm:text-base" style={{ color: "var(--mk-ink)" }}>{service}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {brand.description && (
                            <p className="border-t pt-5 text-sm leading-7" style={{ borderColor: "var(--mk-border)", color: "var(--mk-ink-soft)" }}>{brand.description}</p>
                          )}
                        </div>

                        {/* Real showcase media isn't part of the data model yet — a
                            branded abstract stage built from the brand's OWN real
                            logo (shown large, never cropped/stretched), never a
                            stock photo. Hidden on small screens. */}
                        <div className="relative hidden overflow-hidden lg:block" style={{ background: presentation?.tone || DEFAULT_TONE }}>
                          <span aria-hidden className="absolute -right-10 -top-16 size-72 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,.55), transparent 70%)" }} />
                          <span aria-hidden className="absolute -bottom-20 -left-10 size-64 rounded-full" style={{ background: "radial-gradient(circle, rgba(255,255,255,.35), transparent 70%)" }} />
                          {brand.logoUrl && (
                            <Image
                              src={brand.logoUrl}
                              alt={`${brand.name} logosu`}
                              fill
                              sizes="(min-width: 1024px) 40vw, 0px"
                              className="relative object-contain p-10 transition duration-300 group-hover:scale-[1.03]"
                              unoptimized
                            />
                          )}
                        </div>
                      </article>
                    </MarketingReveal>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ------------------------------------------- SOCIAL PROOF + CTA */}
        {brands.length > 0 && (
          <section className="px-4 py-12 sm:px-6 sm:py-14 lg:px-8" style={{ background: "var(--mk-dark-bg)" }}>
            <div className="mx-auto flex max-w-7xl flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
              <MarketingReveal className="flex flex-wrap gap-x-10 gap-y-6">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-2xl font-black sm:text-3xl" style={{ color: "#fff" }}>{stat.value}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[.1em]" style={{ color: "var(--mk-dark-ink-soft)" }}>{stat.label}</p>
                  </div>
                ))}
              </MarketingReveal>

              <MarketingReveal delay={.05} className="max-w-md">
                <h2 className="text-xl font-black leading-snug sm:text-2xl" style={{ color: "#fff" }}>Sıradaki marka sizinki olabilir.</h2>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--mk-dark-ink-soft)" }}>İşletmenizin dijital görünürlüğünü, reklam altyapısını ve büyüme fırsatlarını birlikte değerlendirelim.</p>
                <Link
                  href="/teklif-al"
                  className="marketing-btn mt-5 inline-flex items-center gap-2"
                  style={{ background: LIME, color: "#11210a", boxShadow: "0 14px 32px rgba(35, 217, 206,.25)" }}
                >
                  Ücretsiz Ön Analiz Al <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </MarketingReveal>
            </div>
          </section>
        )}
      </div>
    </PublicShell>
  );
}

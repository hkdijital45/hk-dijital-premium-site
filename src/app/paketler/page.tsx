import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { disclaimerText } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { CONTENT_NEED_OPTIONS, PACKAGE_CATEGORIES, SOCIAL_STATUS_OPTIONS, URGENCY_OPTIONS, formatTRY, getPackagePricing, normalizeContentNeed, normalizeSocialStatus, normalizeUrgency, recommendServicePackage, servicePackagesByCategory } from "@/lib/packages";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard, MarketingPageHero, MarketingReveal, MarketingSection } from "@/components/public/marketing/MarketingUI";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("packages");
}

export default async function PackagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const hasRobotInput = Boolean(params.hedef || params.platform || params.butce || params.icerik || params.aciliyet || params.sosyal || params.sektor);
  const recommendation = hasRobotInput ? recommendServicePackage({
    sector: params.sektor,
    goal: params.hedef,
    platform: params.platform,
    budget: params.butce,
    contentNeed: params.icerik,
    urgency: params.aciliyet,
    socialStatus: params.sosyal
  }) : null;

  return (
    <PublicShell>
      <div className="marketing-shell">
        <MarketingPageHero
          eyebrow="Paketler"
          title="Reklam, sosyal medya ve raporlama paketlerini net kapsamla seçin."
          text="Meta, Google Ads, kombin reklam yönetimi ve sosyal medya hizmetlerini fiyat, kapsam, ideal müşteri ve kurulum yol haritasıyla karşılaştırın."
        />
        <MarketingSection>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex gap-2 overflow-x-auto rounded-2xl border p-2" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
              {PACKAGE_CATEGORIES.map((category) => (
                <a key={category.key} href={`#${category.key}`} className="shrink-0 rounded-full border px-4 py-2 text-sm font-black transition hover:bg-[#7c3aed] hover:text-white" style={{ borderColor: "var(--mk-border-strong)", color: "var(--mk-violet)" }}>
                  {category.shortLabel}
                </a>
              ))}
            </div>

            <MarketingReveal>
              <MarketingCard feature className="mb-10 overflow-hidden p-8">
                <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
                  <div>
                    <p className="marketing-eyebrow">Paket Analiz Robotu</p>
                    <h2 className="mt-4 text-3xl font-black" style={{ color: "var(--mk-ink)" }}>İşletmeniz için doğru başlangıç paketini bulun.</h2>
                    <p className="mt-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>Hedef, platform, bütçe ve içerik ihtiyacınızı seçin; HK Dijital paket datasına göre öneri üretelim.</p>
                    {recommendation && (
                      <div className="mt-6 rounded-2xl border p-5" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-bg-alt)" }}>
                        <p className="marketing-eyebrow">Önerilen Paket</p>
                        <h3 className="mt-2 text-2xl font-black" style={{ color: "var(--mk-ink)" }}>{recommendation.recommended.title}</h3>
                        {(() => {
                          const pricing = getPackagePricing(recommendation.recommended);
                          return <p className="mt-1 text-xl font-black" style={{ color: "var(--mk-violet)" }}>{pricing?.priceDisplay || recommendation.recommended.title}</p>;
                        })()}
                        <p className="mt-3 text-sm leading-6" style={{ color: "var(--mk-ink)" }}><b>Neden bu paket?</b> {recommendation.reason}</p>
                        <p className="mt-3 text-sm leading-6" style={{ color: "var(--mk-ink-soft)" }}><b>Alternatif seçenek:</b> {recommendation.alternative.title}</p>
                        <p className="mt-3 text-sm leading-6" style={{ color: "var(--mk-ink-soft)" }}><b>HK Dijital yorumu:</b> {recommendation.startingStrategy}</p>
                        <p className="mt-4 marketing-eyebrow">İlk 30 günlük yol haritası</p>
                        <div className="mt-4 grid gap-2">
                          {recommendation.roadmap.map((step) => <span key={step} className="rounded-xl px-3 py-2 text-sm" style={{ background: "var(--mk-surface)", color: "var(--mk-ink)" }}>{step}</span>)}
                        </div>
                      </div>
                    )}
                  </div>
                  <form className="grid gap-3 rounded-2xl border p-4" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }} action="/paketler">
                    <label className="grid gap-1 text-sm font-bold" style={{ color: "var(--mk-ink)" }}>İşletme türü / sektör<input name="sektor" defaultValue={params.sektor || ""} className="min-h-12 rounded-xl border px-4" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-surface)", color: "var(--mk-ink)" }} placeholder="Örn. Klinik, restoran, e-ticaret" /></label>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Select name="hedef" label="Hedef" defaultValue={params.hedef} options={["bilinirlik", "mesaj", "lead", "satış", "randevu", "büyüme"]} />
                      <Select name="platform" label="Platform ihtiyacı" defaultValue={params.platform} options={["Meta", "Google", "Sosyal Medya", "Hepsi"]} />
                      <Select name="butce" label="Aylık reklam bütçesi" defaultValue={params.butce} options={["5.000 TL altı", "5.000-20.000 TL", "20.000-60.000 TL", "60.000 TL üzeri"]} />
                      <Select name="icerik" label="İçerik üretim ihtiyacı" defaultValue={params.icerik ? normalizeContentNeed(params.icerik) : ""} options={CONTENT_NEED_OPTIONS} />
                      <Select name="aciliyet" label="Başlangıç zamanlaması" defaultValue={params.aciliyet ? normalizeUrgency(params.aciliyet) : ""} options={URGENCY_OPTIONS} />
                      <Select name="sosyal" label="Mevcut sosyal medya durumu" defaultValue={params.sosyal ? normalizeSocialStatus(params.sosyal) : ""} options={SOCIAL_STATUS_OPTIONS} />
                    </div>
                    <button className="marketing-btn marketing-btn-primary mt-2">Benim İçin Uygun mu? <ArrowRight size={16} /></button>
                  </form>
                </div>
              </MarketingCard>
            </MarketingReveal>

            <div className="grid gap-12">
              {PACKAGE_CATEGORIES.map((category) => (
                <section key={category.key} id={category.key} className="scroll-mt-28">
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="marketing-eyebrow">{category.shortLabel}</p>
                      <h2 className="mt-2 text-3xl font-black" style={{ color: "var(--mk-ink)" }}>{category.label}</h2>
                      <p className="mt-2 max-w-3xl text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{category.description}</p>
                    </div>
                    <Link href={`/teklif-al?paket=${category.key}`} className="marketing-btn marketing-btn-secondary">Kategori için teklif al</Link>
                  </div>
                  <div className="grid gap-5 lg:grid-cols-3">
                    {servicePackagesByCategory(category.key).map((pkg, index) => {
                      const pricing = getPackagePricing(pkg);
                      return (
                        <MarketingReveal key={pkg.slug} delay={index * 0.05}>
                          <MarketingCard feature={pkg.popular} className="relative p-6">
                            {pkg.popular && <span className="absolute right-5 top-5 rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: "linear-gradient(97deg, var(--mk-violet), var(--mk-blue))" }}>En Çok Tercih Edilen</span>}
                            <p className="text-sm font-black" style={{ color: "var(--mk-violet)" }}>{pkg.categoryLabel}</p>
                            <h3 className="mt-3 text-3xl font-black" style={{ color: "var(--mk-ink)" }}>{pkg.name}</h3>
                            <p className="mt-2 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{pkg.description}</p>
                            <div className="mt-6 rounded-2xl border p-4" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }}>
                              <div className="flex flex-wrap items-end gap-2">
                                <p className="text-4xl font-black" style={{ color: "var(--mk-ink)" }}>{formatTRY(pricing?.basePrice || pkg.monthlyPrice)}</p>
                                <span className="mb-1 rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: "var(--mk-pink)" }}>+ KDV</span>
                              </div>
                              {pricing && <div className="mt-3 grid gap-1 text-sm" style={{ color: "var(--mk-ink-soft)" }}>
                                <span>KDV: <b style={{ color: "var(--mk-ink)" }}>{pricing.vatDisplay}</b></span>
                                <span>KDV dahil: <b style={{ color: "var(--mk-ink)" }}>{pricing.totalDisplay}</b></span>
                              </div>}
                            </div>
                            <p className="mt-3 rounded-xl p-3 text-xs font-bold leading-5" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-ink)" }}>İdeal müşteri: {pkg.idealFor}</p>
                            <ul className="mt-5 grid gap-3">
                              {pkg.features.map((feature) => (
                                <li key={`${pkg.slug}-${feature.label}`} className="flex gap-3 text-sm leading-6" style={{ color: "var(--mk-ink-soft)" }}>
                                  <CheckCircle2 className="mt-1 shrink-0 text-[#7c3aed]" size={17} />
                                  <span><b style={{ color: "var(--mk-ink)" }}>{feature.label}:</b> {feature.value}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-7 grid gap-2">
                              <Link href={`/teklif-al?paket=${pkg.slug}`} className="marketing-btn marketing-btn-primary">Bu Paketi Seç</Link>
                              <Link href={`/iletisim?paket=${pkg.slug}`} className="marketing-btn marketing-btn-secondary">Teklif Al</Link>
                            </div>
                          </MarketingCard>
                        </MarketingReveal>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <MarketingCard className="mt-10 p-7">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 text-[#7c3aed]" size={22} />
                <div>
                  <h2 className="text-xl font-black" style={{ color: "var(--mk-ink)" }}>Önemli bilgilendirme</h2>
                  <p className="mt-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{disclaimerText}</p>
                  <p className="mt-2 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>Paket kapsamı sektör, hedef ve operasyon ihtiyacına göre yazılı teklif aşamasında netleştirilir.</p>
                </div>
              </div>
            </MarketingCard>
          </div>
        </MarketingSection>
      </div>
    </PublicShell>
  );
}

type SelectOption = string | { value: string; label: string };

function Select({ name, label, options, defaultValue }: { name: string; label: string; options: readonly SelectOption[]; defaultValue?: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold" style={{ color: "var(--mk-ink)" }}>
      {label}
      <select name={name} defaultValue={defaultValue || ""} className="min-h-12 rounded-xl border px-4" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-surface)", color: "var(--mk-ink)" }}>
        <option value="">Seçin</option>
        {options.map((option) => {
          const value = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return <option key={value} value={value}>{optionLabel}</option>;
        })}
      </select>
    </label>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { disclaimerText } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { CONTENT_NEED_OPTIONS, PACKAGE_CATEGORIES, SOCIAL_STATUS_OPTIONS, URGENCY_OPTIONS, formatTRY, getPackagePricing, normalizeContentNeed, normalizeSocialStatus, normalizeUrgency, recommendServicePackage, servicePackagesByCategory } from "@/lib/packages";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";

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
      <PageHero
        eyebrow="Paketler"
        title="Reklam, sosyal medya ve raporlama paketlerini net kapsamla seçin."
        text="Meta, Google Ads, kombin reklam yönetimi ve sosyal medya hizmetlerini fiyat, kapsam, ideal müşteri ve kurulum yol haritasıyla karşılaştırın."
      />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex gap-2 overflow-x-auto rounded-[22px] border border-cyan-200/15 bg-white/[0.04] p-2">
            {PACKAGE_CATEGORIES.map((category) => (
              <a key={category.key} href={`#${category.key}`} className="shrink-0 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-200 hover:text-slate-950">
                {category.shortLabel}
              </a>
            ))}
          </div>

          <PremiumCard className="mb-10 overflow-hidden">
            <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
              <div>
                <p className="inline-flex rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-slate-950">Paket Analiz Robotu</p>
                <h2 className="mt-4 text-3xl font-black text-white">İşletmeniz için doğru başlangıç paketini bulun.</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">Hedef, platform, bütçe ve içerik ihtiyacınızı seçin; HK Dijital paket datasına göre öneri üretelim.</p>
                {recommendation && (
                  <div className="mt-6 rounded-[18px] border border-cyan-200/25 bg-cyan-200/10 p-5">
                    <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-100">Önerilen Paket</p>
                    <h3 className="mt-2 text-2xl font-black text-white">{recommendation.recommended.title}</h3>
                    {(() => {
                      const pricing = getPackagePricing(recommendation.recommended);
                      return <p className="mt-1 text-xl font-black text-cyan-100">{pricing?.priceDisplay || recommendation.recommended.title}</p>;
                    })()}
                    <p className="mt-3 text-sm leading-6 text-slate-200"><b>Neden bu paket?</b> {recommendation.reason}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300"><b>Alternatif seçenek:</b> {recommendation.alternative.title}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300"><b>HK Dijital yorumu:</b> {recommendation.startingStrategy}</p>
                    <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-cyan-100">İlk 30 günlük yol haritası</p>
                    <div className="mt-4 grid gap-2">
                      {recommendation.roadmap.map((step) => <span key={step} className="rounded-[12px] bg-white/10 px-3 py-2 text-sm text-slate-100">{step}</span>)}
                    </div>
                  </div>
                )}
              </div>
              <form className="grid gap-3 rounded-[20px] border border-white/10 bg-black/20 p-4" action="/paketler">
                <label className="grid gap-1 text-sm font-bold text-slate-200">İşletme türü / sektör<input name="sektor" defaultValue={params.sektor || ""} className="min-h-12 rounded-[14px] border border-white/10 bg-black/30 px-4 text-white" placeholder="Örn. Klinik, restoran, e-ticaret" /></label>
                <div className="grid gap-3 md:grid-cols-2">
                  <Select name="hedef" label="Hedef" defaultValue={params.hedef} options={["bilinirlik", "mesaj", "lead", "satış", "randevu", "büyüme"]} />
                  <Select name="platform" label="Platform ihtiyacı" defaultValue={params.platform} options={["Meta", "Google", "Sosyal Medya", "Hepsi"]} />
                  <Select name="butce" label="Aylık reklam bütçesi" defaultValue={params.butce} options={["5.000 TL altı", "5.000-20.000 TL", "20.000-60.000 TL", "60.000 TL üzeri"]} />
                  <Select name="icerik" label="İçerik üretim ihtiyacı" defaultValue={params.icerik ? normalizeContentNeed(params.icerik) : ""} options={CONTENT_NEED_OPTIONS} />
                  <Select name="aciliyet" label="Başlangıç zamanlaması" defaultValue={params.aciliyet ? normalizeUrgency(params.aciliyet) : ""} options={URGENCY_OPTIONS} />
                  <Select name="sosyal" label="Mevcut sosyal medya durumu" defaultValue={params.sosyal ? normalizeSocialStatus(params.sosyal) : ""} options={SOCIAL_STATUS_OPTIONS} />
                </div>
                <button className="mt-2 inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-300 px-5 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-200">
                  Benim İçin Uygun mu? <ArrowRight className="ml-2" size={16} />
                </button>
              </form>
            </div>
          </PremiumCard>

          <div className="grid gap-12">
            {PACKAGE_CATEGORIES.map((category) => (
              <section key={category.key} id={category.key} className="scroll-mt-28">
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-200">{category.shortLabel}</p>
                    <h2 className="mt-2 text-3xl font-black text-white">{category.label}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{category.description}</p>
                  </div>
                  <Link href={`/teklif-al?paket=${category.key}`} className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-5 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-200 hover:text-slate-950">Kategori için teklif al</Link>
                </div>
                <div className="grid gap-5 lg:grid-cols-3">
                  {servicePackagesByCategory(category.key).map((pkg) => {
                    const pricing = getPackagePricing(pkg);
                    return (
                    <article key={pkg.slug} className={`group relative overflow-hidden rounded-[24px] border p-6 shadow-[0_24px_90px_rgba(0,0,0,.22)] transition hover:-translate-y-2 ${pkg.popular ? "border-cyan-200/60 bg-cyan-200/[0.09]" : "border-white/10 bg-white/[0.045]"}`}>
                      <div className="absolute -right-10 -top-10 size-32 rounded-full bg-cyan-300/10 blur-3xl transition group-hover:bg-yellow-300/20" />
                      {pkg.popular && <span className="absolute right-5 top-5 rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-slate-950">En Çok Tercih Edilen</span>}
                      <p className="text-sm font-black text-cyan-100">{pkg.categoryLabel}</p>
                      <h3 className="mt-3 text-3xl font-black text-white">{pkg.name}</h3>
                      <p className="mt-2 text-sm leading-7 text-slate-300">{pkg.description}</p>
                      <div className="mt-6 rounded-[18px] border border-cyan-200/20 bg-black/20 p-4">
                        <div className="flex flex-wrap items-end gap-2">
                          <p className="text-4xl font-black text-cyan-100">{formatTRY(pricing?.basePrice || pkg.monthlyPrice)}</p>
                          <span className="mb-1 rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-slate-950">+ KDV</span>
                        </div>
                        {pricing && <div className="mt-3 grid gap-1 text-sm text-slate-300">
                          <span>KDV: <b className="text-slate-100">{pricing.vatDisplay}</b></span>
                          <span>KDV dahil: <b className="text-slate-100">{pricing.totalDisplay}</b></span>
                        </div>}
                      </div>
                      <p className="mt-3 rounded-[14px] bg-white/10 p-3 text-xs font-bold leading-5 text-slate-200">İdeal müşteri: {pkg.idealFor}</p>
                      <ul className="mt-5 grid gap-3">
                        {pkg.features.map((feature) => (
                          <li key={`${pkg.slug}-${feature.label}`} className="flex gap-3 text-sm leading-6 text-slate-300">
                            <CheckCircle2 className="mt-1 shrink-0 text-cyan-200" size={17} />
                            <span><b className="text-slate-100">{feature.label}:</b> {feature.value}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-7 grid gap-2">
                        <Link href={`/teklif-al?paket=${pkg.slug}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-300 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-200">Bu Paketi Seç</Link>
                        <Link href={`/iletisim?paket=${pkg.slug}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-yellow-200/30 bg-yellow-300/10 px-5 text-sm font-black text-yellow-100 transition hover:bg-yellow-300 hover:text-slate-950">Teklif Al</Link>
                      </div>
                    </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <PremiumCard className="mt-10">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 text-yellow-200" size={22} />
              <div>
                <h2 className="text-xl font-black text-white">Önemli bilgilendirme</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">{disclaimerText}</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">Paket kapsamı sektör, hedef ve operasyon ihtiyacına göre yazılı teklif aşamasında netleştirilir.</p>
              </div>
            </div>
          </PremiumCard>
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

type SelectOption = string | { value: string; label: string };

function Select({ name, label, options, defaultValue }: { name: string; label: string; options: readonly SelectOption[]; defaultValue?: string }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-200">
      {label}
      <select name={name} defaultValue={defaultValue || ""} className="min-h-12 rounded-[14px] border border-white/10 bg-black/30 px-4 text-white">
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

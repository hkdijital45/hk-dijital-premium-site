import Image from "next/image";
import { MarketingButton, MarketingEyebrow, MarketingHeading, MarketingReveal, MarketingSection } from "./marketing/MarketingUI";
import type { PublicBrandShowcase } from "@/lib/brand-showcase-public";

// "HK Dijital ile Çalışan Markalar" — admin-managed (see BrandShowcaseCenter /
// /hk-admin/markalar), read here as plain data. Each brand gets its own tall,
// vertically-centered showcase card — not a small logo grid — stacked with
// strong whitespace so every logo colorway (bej, siyah/beyaz, kırmızı/yeşil…)
// sits on the same neutral, padded, object-contain presentation surface.
export function BrandShowcaseSection({ brands }: { brands: PublicBrandShowcase[] }) {
  if (!brands.length) return null;

  return (
    <MarketingSection id="calisan-markalar" alt>
      <MarketingReveal className="mx-auto max-w-2xl text-center">
        <MarketingEyebrow>İş Birlikleri</MarketingEyebrow>
        <MarketingHeading>HK Dijital ile Çalışan Markalar</MarketingHeading>
        <p className="mt-4 text-base leading-7 sm:text-lg" style={{ color: "var(--mk-ink-soft)" }}>
          Farklı sektörlerden markaların dijital süreçlerini strateji, reklam ve sosyal medya çözümleriyle destekliyoruz.
        </p>
      </MarketingReveal>

      <div className="mx-auto mt-12 grid max-w-2xl gap-6 sm:mt-16 sm:gap-8">
        {brands.map((brand, index) => (
          <MarketingReveal key={brand.id} delay={Math.min(index, 4) * 0.06}>
            <article className="marketing-card marketing-card-feature flex flex-col items-center gap-5 px-6 py-10 text-center sm:px-10 sm:py-12">
              <div
                className="grid size-24 shrink-0 place-items-center rounded-[18px] border bg-white p-4 sm:size-28"
                style={{ borderColor: "var(--mk-border-strong)", boxShadow: "0 1px 2px rgba(15,16,36,.05)" }}
              >
                {brand.logoUrl && (
                  <Image
                    src={brand.logoUrl}
                    alt={`${brand.name} logosu`}
                    width={112}
                    height={112}
                    className="h-full w-full object-contain"
                    sizes="112px"
                    unoptimized
                  />
                )}
              </div>

              <h3 className="break-words text-2xl font-black leading-tight sm:text-3xl" style={{ color: "var(--mk-ink)" }}>{brand.name}</h3>

              {brand.services.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2">
                  {brand.services.map((service) => (
                    <span key={service} className="marketing-badge">{service}</span>
                  ))}
                </div>
              )}

              {brand.description && (
                <p className="max-w-md text-sm leading-7 sm:text-base" style={{ color: "var(--mk-ink-soft)" }}>{brand.description}</p>
              )}
            </article>
          </MarketingReveal>
        ))}
      </div>

      <MarketingReveal className="mt-10 text-center sm:mt-12">
        <MarketingButton href="/calistigimiz-markalar" variant="secondary" trackingLabel="Tüm Markaları Gör CTA">
          Tüm Markaları Gör
        </MarketingButton>
      </MarketingReveal>
    </MarketingSection>
  );
}

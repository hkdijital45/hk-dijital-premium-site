import Link from "next/link";
import { Compass, Home, MessageCircle } from "lucide-react";
import { PublicShell } from "@/components/public/Shell";
import { MarketingButton, MarketingCard, MarketingEyebrow, MarketingHeading, MarketingSection } from "@/components/public/marketing/MarketingUI";

// Rendered when notFound() is thrown inside an already-matched route
// segment (e.g. /hizmetler/[slug] with an unknown slug, /blog/[slug] with
// an unknown post) — a genuinely unmatched URL with no matching segment at
// all is instead handled by global-not-found.tsx (see its own comment for
// why root app/not-found.tsx alone isn't enough in this Next.js build).
// This one IS nested inside the real root layout, so PublicShell (real
// header/footer/logo/contact data) renders normally here.
export default function NotFound() {
  return (
    <PublicShell>
      <div className="marketing-shell">
        <MarketingSection>
          <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center sm:px-6 lg:px-8">
            <MarketingEyebrow>404</MarketingEyebrow>
            <MarketingHeading as="h1" className="mt-4">Bu sayfa bulunamadı</MarketingHeading>
            <p className="mt-5 max-w-xl text-base leading-7" style={{ color: "var(--mk-ink-soft)" }}>
              Aradığınız sayfa taşınmış veya kaldırılmış olabilir. Aşağıdaki bağlantılardan devam edebilir ya da ana sayfaya dönebilirsiniz.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <MarketingButton href="/" trackingLabel="404 Ana Sayfa">
                <Home size={17} /> Ana Sayfaya Dön
              </MarketingButton>
              <MarketingButton href="/iletisim" variant="secondary" trackingLabel="404 İletişim">
                <MessageCircle size={17} /> Bize Ulaşın
              </MarketingButton>
            </div>

            <div className="mt-14 grid w-full gap-4 sm:grid-cols-3">
              <MarketingCard className="p-5 text-left">
                <Compass className="text-[#23D9CE]" size={20} />
                <h2 className="mt-3 text-sm font-black" style={{ color: "var(--mk-ink)" }}>Hizmetler</h2>
                <Link href="/hizmetler" className="mt-2 block text-sm font-bold" style={{ color: "var(--mk-violet)" }}>
                  Hizmet kapsamını inceleyin
                </Link>
              </MarketingCard>
              <MarketingCard className="p-5 text-left">
                <Compass className="text-[#23D9CE]" size={20} />
                <h2 className="mt-3 text-sm font-black" style={{ color: "var(--mk-ink)" }}>Paketler</h2>
                <Link href="/paketler" className="mt-2 block text-sm font-bold" style={{ color: "var(--mk-violet)" }}>
                  Fiyat ve kapsamı görün
                </Link>
              </MarketingCard>
              <MarketingCard className="p-5 text-left">
                <Compass className="text-[#23D9CE]" size={20} />
                <h2 className="mt-3 text-sm font-black" style={{ color: "var(--mk-ink)" }}>Blog</h2>
                <Link href="/blog" className="mt-2 block text-sm font-bold" style={{ color: "var(--mk-violet)" }}>
                  Rehberleri okuyun
                </Link>
              </MarketingCard>
            </div>
          </div>
        </MarketingSection>
      </div>
    </PublicShell>
  );
}

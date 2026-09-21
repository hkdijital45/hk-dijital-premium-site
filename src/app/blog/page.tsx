import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, Clock, Search } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard, MarketingPageHero, MarketingReveal, MarketingSection } from "@/components/public/marketing/MarketingUI";
import { MarketingCTA, MarketingNetworkBackground } from "@/components/public/marketing/MarketingVisualSystem";
import { absoluteUrl, pageMetadata } from "@/lib/metadata";
import { blogCategories, getPublicBlogPosts } from "@/lib/blog-seo";
import { servicePages } from "@/lib/public-seo-content";

export const dynamic = "force-dynamic";

type BlogPageProps = {
  searchParams?: Promise<{ q?: string; kategori?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const meta = await pageMetadata("blog");
  return {
    ...meta,
    alternates: { canonical: absoluteUrl("/blog") }
  };
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const q = (params?.q || "").trim().toLocaleLowerCase("tr");
  const kategori = (params?.kategori || "").trim();
  const posts = await getPublicBlogPosts();
  const filtered = posts.filter((post) => {
    const categoryMatches = !kategori || post.category?.slug === kategori;
    const queryMatches = !q || `${post.title} ${post.excerpt} ${post.primary_keyword}`.toLocaleLowerCase("tr").includes(q);
    return categoryMatches && queryMatches;
  });
  const featured = filtered.find((post) => post.featured) || filtered[0];
  const rest = filtered.filter((post) => post.slug !== featured?.slug);
  const hasAnyPublished = posts.length > 0;

  return (
    <PublicShell>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "HK Dijital Blog",
        url: absoluteUrl("/blog"),
        description: "İşletmeler için reklam, sosyal medya ve dijital pazarlama rehberleri."
      }} />
      <div className="marketing-shell">
        <MarketingPageHero
          eyebrow="Blog"
          title="İşletmeler İçin Reklam ve Dijital Pazarlama Rehberleri"
          text="Instagram reklamı vermek, Google Ads bütçesi belirlemek, sosyal medyadan müşteri bulmak ve yerel işletme reklamlarını daha doğru planlamak için pratik içerikler."
          visual={<MarketingNetworkBackground />}
        />
        <MarketingSection>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <form className="grid gap-3 rounded-2xl border p-3 sm:grid-cols-[1fr_auto]" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--mk-ink-faint)" }} size={18} />
                <input name="q" defaultValue={params?.q || ""} placeholder="Blog içinde ara" className="min-h-12 w-full rounded-xl border pl-11 pr-4 text-base outline-none transition" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-bg-alt)", color: "var(--mk-ink)" }} />
              </label>
              <button className="marketing-btn marketing-btn-primary" type="submit">Ara</button>
            </form>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
              <Link href="/blog" className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition" style={{ background: !kategori ? "var(--mk-violet)" : "var(--mk-bg-alt)", color: !kategori ? "#fff" : "var(--mk-ink-soft)" }}>Tümü</Link>
              {blogCategories.map((category) => (
                <Link key={category.slug} href={`/blog?kategori=${category.slug}`} className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition" style={{ background: kategori === category.slug ? "var(--mk-violet)" : "var(--mk-bg-alt)", color: kategori === category.slug ? "#fff" : "var(--mk-ink-soft)" }}>{category.name}</Link>
              ))}
            </div>

            {!hasAnyPublished ? (
              <MarketingReveal>
                <MarketingCard className="mt-8 flex flex-col items-center gap-4 p-10 text-center">
                  <BookOpenText className="text-[#7c3aed]" size={34} />
                  <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Yeni içerikler hazırlanıyor</h2>
                  <p className="max-w-xl text-base leading-8" style={{ color: "var(--mk-ink-soft)" }}>
                    HK Dijital blogu; reklam, sosyal medya ve dijital pazarlama üzerine pratik rehberlerle yakında burada. Bu arada hizmetlerimizi inceleyebilir veya doğrudan bizimle iletişime geçebilirsiniz.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link href="/hizmetler" className="marketing-btn marketing-btn-primary">Hizmetlerimizi İnceleyin</Link>
                    <Link href="/teklif-al" className="marketing-btn marketing-btn-secondary">Ücretsiz Ön Görüşme</Link>
                  </div>
                </MarketingCard>
              </MarketingReveal>
            ) : (
              <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.7fr]">
                <div className="grid gap-5">
                  {featured ? (
                    <MarketingReveal>
                      <Link href={`/blog/${featured.slug}`}>
                        <MarketingCard feature className="p-7">
                          <span className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide text-white" style={{ background: "var(--mk-violet)" }}>Öne çıkan</span>
                          <h2 className="mt-5 text-3xl font-black" style={{ color: "var(--mk-ink)" }}>{featured.title}</h2>
                          <p className="mt-4 text-base leading-8" style={{ color: "var(--mk-ink-soft)" }}>{featured.excerpt}</p>
                          <div className="mt-5 flex flex-wrap gap-3 text-sm" style={{ color: "var(--mk-ink-faint)" }}>
                            <span>{featured.category?.name || "Blog"}</span>
                            <span className="inline-flex items-center gap-1"><Clock size={15} /> {featured.reading_time} dk</span>
                            <span>{featured.published_at ? new Date(featured.published_at).toLocaleDateString("tr-TR") : "Yayında"}</span>
                          </div>
                        </MarketingCard>
                      </Link>
                    </MarketingReveal>
                  ) : (
                    <MarketingCard className="p-6 text-center">
                      <span style={{ color: "var(--mk-ink-soft)" }}>Bu filtreye uygun içerik bulunamadı. Farklı bir arama veya kategori deneyin.</span>
                    </MarketingCard>
                  )}
                  <div className="grid gap-5 md:grid-cols-2">
                    {rest.map((post, index) => (
                      <MarketingReveal key={post.slug} delay={index * 0.04}>
                        <Link href={`/blog/${post.slug}`}>
                          <MarketingCard className="p-6">
                            <BookOpenText className="text-[#7c3aed]" size={26} />
                            <p className="mt-5 text-xs font-black uppercase tracking-wide" style={{ color: "var(--mk-violet)" }}>{post.category?.name || "Blog"} · {post.reading_time} dk</p>
                            <h2 className="mt-3 text-2xl font-black" style={{ color: "var(--mk-ink)" }}>{post.title}</h2>
                            <p className="mt-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>{post.excerpt}</p>
                          </MarketingCard>
                        </Link>
                      </MarketingReveal>
                    ))}
                  </div>
                </div>
                <MarketingCard className="p-7">
                  <h2 className="text-xl font-black" style={{ color: "var(--mk-ink)" }}>Hizmetlerimiz</h2>
                  <p className="mt-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>Blogda okuduklarınızı doğrudan uygulamak isterseniz, ilgili hizmet sayfamıza göz atın.</p>
                  <div className="mt-5 grid gap-3">
                    {servicePages.map((service) => (
                      <Link key={service.slug} href={`/hizmetler/${service.slug}`} className="rounded-xl border p-4 text-sm transition hover:-translate-y-0.5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)", color: "var(--mk-ink)" }}>
                        <strong>{service.eyebrow}</strong><br /><span style={{ color: "var(--mk-ink-soft)" }}>{service.title}</span>
                      </Link>
                    ))}
                  </div>
                </MarketingCard>
              </div>
            )}
          </div>
          <div className="mx-auto mt-10 max-w-7xl px-4 sm:px-6 lg:px-8">
            <MarketingReveal>
              <MarketingCTA
                title="Okuduklarınızı işletmenize uygulayalım"
                text="Kısa bir ön görüşmeyle blogdaki stratejilerin işletmeniz için nasıl işleyeceğini birlikte değerlendirelim."
                trackingPrefix="Blog Listesi"
              />
            </MarketingReveal>
          </div>
        </MarketingSection>
      </div>
    </PublicShell>
  );
}

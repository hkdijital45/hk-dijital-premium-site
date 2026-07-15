import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, Clock, Search } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";
import { absoluteUrl, pageMetadata } from "@/lib/metadata";
import { blogCategories, contentIntentMap, getPublicBlogPosts } from "@/lib/blog-seo";

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

  return (
    <PublicShell>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Blog",
        name: "HK Dijital Blog",
        url: absoluteUrl("/blog"),
        description: "İşletmeler için reklam, sosyal medya ve dijital pazarlama rehberleri."
      }} />
      <PageHero
        eyebrow="Blog"
        title="İşletmeler İçin Reklam ve Dijital Pazarlama Rehberleri"
        text="Instagram reklamı vermek, Google Ads bütçesi belirlemek, sosyal medyadan müşteri bulmak ve yerel işletme reklamlarını daha doğru planlamak için pratik içerikler."
      />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <form className="grid gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-3 sm:grid-cols-[1fr_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input name="q" defaultValue={params?.q || ""} placeholder="Blog içinde ara" className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-950/70 pl-11 pr-4 text-base text-white outline-none transition focus:border-cyan-300" />
            </label>
            <button className="min-h-12 rounded-2xl bg-cyan-300 px-6 text-sm font-black text-slate-950 transition hover:bg-cyan-200" type="submit">Ara</button>
          </form>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            <Link href="/blog" className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${!kategori ? "bg-yellow-300 text-slate-950" : "bg-white/10 text-slate-200 hover:bg-white/15"}`}>Tümü</Link>
            {blogCategories.map((category) => (
              <Link key={category.slug} href={`/blog?kategori=${category.slug}`} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${kategori === category.slug ? "bg-yellow-300 text-slate-950" : "bg-white/10 text-slate-200 hover:bg-white/15"}`}>{category.name}</Link>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.7fr]">
            <div className="grid gap-5">
              {featured ? (
                <Link href={`/blog/${featured.slug}`} className="impact-card glass-card block p-7 transition hover:-translate-y-1 hover:border-cyan-200/25">
                  <span className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-black uppercase tracking-[.16em] text-slate-950">Öne çıkan</span>
                  <h2 className="mt-5 text-3xl font-black text-white">{featured.title}</h2>
                  <p className="mt-4 text-base leading-8 text-slate-300">{featured.excerpt}</p>
                  <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-400">
                    <span>{featured.category?.name || "Blog"}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={15} /> {featured.reading_time} dk</span>
                    <span>{featured.published_at ? new Date(featured.published_at).toLocaleDateString("tr-TR") : "Yayında"}</span>
                  </div>
                </Link>
              ) : (
                <PremiumCard>Bu filtreye uygun yayınlanmış içerik bulunamadı.</PremiumCard>
              )}
              <div className="grid gap-5 md:grid-cols-2">
                {rest.map((post) => (
                  <Link key={post.slug} href={`/blog/${post.slug}`} className="impact-card glass-card block p-6 transition hover:-translate-y-1 hover:border-cyan-200/25">
                    <BookOpenText className="text-cyan-200" size={26} />
                    <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-cyan-200">{post.category?.name || "Blog"} · {post.reading_time} dk</p>
                    <h2 className="mt-3 text-2xl font-black text-white">{post.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-300">{post.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
            <PremiumCard>
              <h2 className="text-xl font-black text-white">İçerik konu haritası</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">Arama hacmi uydurmadan, gerçek kullanıcı niyetlerine göre planlanan içerik kümeleri.</p>
              <div className="mt-5 grid gap-3">
                {contentIntentMap.slice(0, 8).map((item) => <div key={item.phrase} className="rounded-[14px] border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200"><strong>{item.phrase}</strong><br />{item.intent} · {item.priority}</div>)}
              </div>
            </PremiumCard>
          </div>
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

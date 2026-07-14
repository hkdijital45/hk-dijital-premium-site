import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";
import { absoluteUrl, pageMetadata } from "@/lib/metadata";
import { blogPlan, blogPosts } from "@/lib/public-seo-content";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("blog");
}

export default function BlogPage() {
  return (
    <PublicShell>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") }
        ]
      }} />
      <PageHero
        eyebrow="Blog"
        title="Dijital Pazarlama, Reklam ve Yerel Büyüme Rehberleri"
        text="Manisa’daki ve Türkiye genelindeki işletmeler için Meta reklamları, Google Ads, sosyal medya yönetimi ve dönüşüm takibi üzerine uygulanabilir rehberler."
      />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.1fr_.7fr]">
          <div className="grid gap-5">
            {blogPosts.map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="impact-card glass-card block p-6 transition hover:-translate-y-1 hover:border-cyan-200/25">
                <BookOpenText className="text-cyan-200" size={28} />
                <p className="mt-5 text-xs font-black uppercase tracking-[.18em] text-cyan-200">{post.date} · {post.readingTime}</p>
                <h2 className="mt-3 text-2xl font-black text-white">{post.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">{post.description}</p>
              </Link>
            ))}
          </div>
          <PremiumCard>
            <h2 className="text-xl font-black text-white">İçerik planı</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">Aşağıdaki başlıklar yüzeysel makale olarak yayına alınmadı; nitelikli içerik üretimi için planlandı.</p>
            <div className="mt-5 grid gap-3">
              {blogPlan.map((item) => <div key={item} className="rounded-[14px] border border-white/10 bg-white/[0.04] p-4 text-sm font-bold text-slate-200">{item}</div>)}
            </div>
          </PremiumCard>
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}

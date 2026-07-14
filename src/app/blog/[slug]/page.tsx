import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";
import { absoluteUrl } from "@/lib/metadata";
import { blogPosts } from "@/lib/public-seo-content";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = blogPosts.find((item) => item.slug === slug);
  if (!post) return {};
  return {
    metadataBase: new URL(absoluteUrl("/")),
    title: `${post.title} | HK Dijital`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: post.date,
      modifiedTime: post.updated,
      authors: [post.author]
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description
    }
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = blogPosts.find((item) => item.slug === slug);
  if (!post) notFound();

  return (
    <PublicShell>
      <JsonLd data={[
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
            { "@type": "ListItem", position: 3, name: post.title, item: absoluteUrl(`/blog/${post.slug}`) }
          ]
        },
        {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.updated,
          author: { "@type": "Organization", name: post.author },
          publisher: { "@type": "Organization", name: "HK Dijital", url: absoluteUrl("/") },
          mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`)
        }
      ]} />
      <PageHero eyebrow="Blog" title={post.title} text={post.description} />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-4xl">
          <PremiumCard>
            <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-slate-300">
              <span className="inline-flex items-center gap-2"><CalendarDays size={16} /> {post.date}</span>
              <span>Güncellendi: {post.updated}</span>
              <span>{post.readingTime}</span>
              <span>Yazar: {post.author}</span>
            </div>
            <div className="mt-8 grid gap-8">
              {post.sections.map(([title, text]) => (
                <section key={title}>
                  <h2 className="text-2xl font-black text-white">{title}</h2>
                  <p className="mt-4 text-base leading-8 text-slate-300">{text}</p>
                </section>
              ))}
            </div>
            <div className="mt-10 rounded-[18px] border border-cyan-200/20 bg-cyan-200/[0.08] p-5">
              <h2 className="text-xl font-black text-white">İlgili hizmetler</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/hizmetler/meta-reklam-yonetimi" className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Meta reklam yönetimi</Link>
                <Link href="/hizmetler/google-ads-yonetimi" className="rounded-full border border-cyan-200/25 px-4 py-2 text-sm font-black text-cyan-100">Google Ads danışmanlığı</Link>
                <Link href="/teklif-al" className="rounded-full border border-yellow-200/30 px-4 py-2 text-sm font-black text-yellow-100">Ücretsiz ön görüşme</Link>
              </div>
            </div>
          </PremiumCard>
        </article>
      </AnimatedSection>
    </PublicShell>
  );
}

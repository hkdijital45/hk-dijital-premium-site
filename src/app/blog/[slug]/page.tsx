import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Clock, UserRound } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard } from "@/components/public/marketing/MarketingUI";
import { absoluteUrl } from "@/lib/metadata";
import { getPublicBlogPost, getPublicBlogPosts } from "@/lib/blog-seo";
import { extractMarkdownHeadings, markdownToSafeHtml } from "@/lib/blog-markdown";

type BlogDetailProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: BlogDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicBlogPost(slug);
  if (!post) return { title: "Blog yazısı bulunamadı", robots: { index: false, follow: false } };
  const url = absoluteUrl(`/blog/${post.slug}`);
  const ogImage = post.og_image_url || post.cover_image_url;
  const image = ogImage ? [{ url: ogImage, alt: post.cover_image_alt || post.title }] : undefined;
  return {
    title: { absolute: post.meta_title || post.title },
    description: post.meta_description || post.excerpt,
    alternates: { canonical: url },
    robots: { index: post.allow_indexing, follow: post.allow_indexing },
    authors: [{ name: post.author_name }],
    openGraph: {
      title: post.og_title || post.meta_title || post.title,
      description: post.og_description || post.meta_description || post.excerpt,
      url,
      type: "article",
      publishedTime: post.published_at || undefined,
      modifiedTime: post.updated_at || post.published_at || undefined,
      authors: [post.author_name],
      section: post.category?.name,
      tags: [post.primary_keyword, ...post.secondary_keywords].filter(Boolean),
      images: image
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: post.og_title || post.meta_title || post.title,
      description: post.og_description || post.meta_description || post.excerpt,
      images: image
    }
  };
}

export default async function BlogDetailPage({ params }: BlogDetailProps) {
  const { slug } = await params;
  const [post, posts] = await Promise.all([getPublicBlogPost(slug), getPublicBlogPosts()]);
  if (!post) notFound();
  const headings = extractMarkdownHeadings(post.content).filter((heading) => heading.level === 2);
  const contentHtml = markdownToSafeHtml(post.content);
  const related = posts.filter((item) => item.slug !== post.slug && item.category?.slug === post.category?.slug).slice(0, 3);
  const url = absoluteUrl(`/blog/${post.slug}`);

  return (
    <PublicShell>
      <JsonLd data={[{
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description: post.excerpt,
        mainEntityOfPage: url,
        datePublished: post.published_at,
        dateModified: post.updated_at || post.published_at,
        author: { "@type": "Person", name: post.author_name },
        publisher: { "@type": "Organization", name: "HK Dijital", url: absoluteUrl("/") },
        articleSection: post.category?.name,
        keywords: [post.primary_keyword, ...post.secondary_keywords].filter(Boolean).join(", "),
        image: post.og_image_url || post.cover_image_url || undefined
      }, {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
          { "@type": "ListItem", position: 3, name: post.title, item: url }
        ]
      }]} />
      <main className="marketing-shell px-4 py-14 sm:px-6 lg:px-8">
        <article className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <nav className="flex flex-wrap gap-2 text-sm" style={{ color: "var(--mk-ink-faint)" }} aria-label="Breadcrumb">
              <Link href="/" className="hover:underline">Ana Sayfa</Link><span>/</span>
              <Link href="/blog" className="hover:underline">Blog</Link><span>/</span>
              <span style={{ color: "var(--mk-ink-soft)" }}>{post.category?.name || "Yazı"}</span>
            </nav>
            <header className="mt-8 rounded-[28px] border p-6 sm:p-8" style={{ borderColor: "var(--mk-border-strong)", background: "linear-gradient(135deg, rgba(124,58,237,.06), rgba(37,99,235,.04))" }}>
              <p className="marketing-eyebrow">{post.category?.name || "Blog"}</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl" style={{ color: "var(--mk-ink)" }}>{post.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8" style={{ color: "var(--mk-ink-soft)" }}>{post.excerpt}</p>
              <div className="mt-7 flex flex-wrap gap-4 text-sm" style={{ color: "var(--mk-ink-soft)" }}>
                <span className="inline-flex items-center gap-2"><UserRound size={16} /> {post.author_name}</span>
                <span className="inline-flex items-center gap-2"><CalendarDays size={16} /> {post.published_at ? new Date(post.published_at).toLocaleDateString("tr-TR") : "Yayında"}</span>
                <span className="inline-flex items-center gap-2"><Clock size={16} /> {post.reading_time} dk okuma</span>
              </div>
            </header>
            {post.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.cover_image_url} alt={post.cover_image_alt || ""} className="mt-8 h-auto w-full rounded-[28px] border object-cover" style={{ borderColor: "var(--mk-border)", maxHeight: 420 }} />
            ) : null}
            <div className="blog-article-content mt-10 rounded-[28px] border p-6 sm:p-8" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }} dangerouslySetInnerHTML={{ __html: contentHtml }} />
            <section className="mt-10 rounded-[24px] border p-6" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-bg-alt)" }}>
              <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Bu konuyu işletmeniz için değerlendirelim</h2>
              <p className="mt-3 max-w-2xl leading-7" style={{ color: "var(--mk-ink-soft)" }}>Reklam bütçenizi, kanal seçiminizi veya satışa dönüşmeyen kampanyalarınızı birlikte incelemek için kısa bir ön görüşme talep edebilirsiniz.</p>
              <Link href="/teklif-al" className="marketing-btn marketing-btn-primary mt-5">Ücretsiz Ön Görüşme <ArrowRight size={16} /></Link>
            </section>
          </div>
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            {headings.length ? <MarketingCard className="p-5"><h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--mk-violet)" }}>İçindekiler</h2><div className="mt-4 grid gap-3 text-sm" style={{ color: "var(--mk-ink-soft)" }}>{headings.map((heading) => <a key={heading.id} href={`#${heading.id}`} className="hover:underline">{heading.text}</a>)}</div></MarketingCard> : null}
            <MarketingCard className="p-5"><h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--mk-pink)" }}>Yazar</h2><p className="mt-3 text-lg font-black" style={{ color: "var(--mk-ink)" }}>{post.author_name}</p><p className="mt-2 text-sm leading-6" style={{ color: "var(--mk-ink-faint)" }}>HK Dijital’de reklam yönetimi, sosyal medya stratejisi ve ölçümleme odaklı dijital pazarlama içerikleri hazırlar.</p></MarketingCard>
            {related.length ? <MarketingCard className="p-5"><h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--mk-violet)" }}>İlgili Yazılar</h2><div className="mt-4 grid gap-3">{related.map((item) => <Link key={item.slug} href={`/blog/${item.slug}`} className="rounded-xl p-3 text-sm font-bold leading-6 transition hover:bg-[#7c3aed]/[0.06]" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-ink)" }}>{item.title}</Link>)}</div></MarketingCard> : null}
          </aside>
        </article>
      </main>
    </PublicShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Clock, UserRound } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard } from "@/components/public/marketing/MarketingUI";
import { absoluteUrl } from "@/lib/metadata";
import { getPublicBlogPost, getPublicBlogPosts } from "@/lib/blog-seo";

type BlogDetailProps = { params: Promise<{ slug: string }> };

function headingId(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderInline(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!match) return <span key={`${part}-${index}`}>{part}</span>;
    const [, label, href] = match;
    const external = /^https?:\/\//.test(href);
    return <Link key={`${href}-${index}`} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="font-bold underline decoration-[#7c3aed]/40 underline-offset-4" style={{ color: "var(--mk-violet)" }}>{label}</Link>;
  });
}

function BlogMarkdown({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="space-y-7">
      {blocks.map((block, index) => {
        if (block.startsWith("# ")) return null;
        if (block.startsWith("## ")) {
          const label = block.replace(/^##\s+/, "");
          return <h2 key={index} id={headingId(label)} className="scroll-mt-28 text-2xl font-black tracking-tight" style={{ color: "var(--mk-ink)" }}>{label}</h2>;
        }
        if (block.includes("\n- ")) {
          const lines = block.split("\n").filter(Boolean);
          const lead = lines.find((line) => !line.startsWith("- "));
          const items = lines.filter((line) => line.startsWith("- ")).map((line) => line.replace(/^- /, ""));
          return (
            <div key={index} className="rounded-2xl border p-5" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }}>
              {lead ? <p className="mb-3 leading-8" style={{ color: "var(--mk-ink)" }}>{renderInline(lead)}</p> : null}
              <ul className="grid gap-2">{items.map((item) => <li key={item} className="leading-7" style={{ color: "var(--mk-ink-soft)" }}>• {renderInline(item)}</li>)}</ul>
            </div>
          );
        }
        return <p key={index} className="text-lg leading-9" style={{ color: "var(--mk-ink-soft)" }}>{renderInline(block)}</p>;
      })}
    </div>
  );
}

export async function generateMetadata({ params }: BlogDetailProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicBlogPost(slug);
  if (!post) return { title: "Blog yazısı bulunamadı", robots: { index: false, follow: false } };
  const url = absoluteUrl(`/blog/${post.slug}`);
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
      tags: [post.primary_keyword, ...post.secondary_keywords].filter(Boolean)
    }
  };
}

export default async function BlogDetailPage({ params }: BlogDetailProps) {
  const { slug } = await params;
  const [post, posts] = await Promise.all([getPublicBlogPost(slug), getPublicBlogPosts()]);
  if (!post) notFound();
  const headings = post.content.split("\n").filter((line) => /^##\s/.test(line)).map((line) => line.replace(/^##\s+/, ""));
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
        keywords: [post.primary_keyword, ...post.secondary_keywords].filter(Boolean).join(", ")
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
            <div className="mt-10 rounded-[28px] border p-6 sm:p-8" style={{ borderColor: "var(--mk-border)", background: "var(--mk-surface)" }}><BlogMarkdown content={post.content} /></div>
            <section className="mt-10 rounded-[24px] border p-6" style={{ borderColor: "var(--mk-border-strong)", background: "var(--mk-bg-alt)" }}>
              <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>Bu konuyu işletmeniz için değerlendirelim</h2>
              <p className="mt-3 max-w-2xl leading-7" style={{ color: "var(--mk-ink-soft)" }}>Reklam bütçenizi, kanal seçiminizi veya satışa dönüşmeyen kampanyalarınızı birlikte incelemek için kısa bir ön görüşme talep edebilirsiniz.</p>
              <Link href="/teklif-al" className="marketing-btn marketing-btn-primary mt-5">Ücretsiz Ön Görüşme <ArrowRight size={16} /></Link>
            </section>
          </div>
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            {headings.length ? <MarketingCard className="p-5"><h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--mk-violet)" }}>İçindekiler</h2><div className="mt-4 grid gap-3 text-sm" style={{ color: "var(--mk-ink-soft)" }}>{headings.map((heading) => <a key={heading} href={`#${headingId(heading)}`} className="hover:underline">{heading}</a>)}</div></MarketingCard> : null}
            <MarketingCard className="p-5"><h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--mk-pink)" }}>Yazar</h2><p className="mt-3 text-lg font-black" style={{ color: "var(--mk-ink)" }}>{post.author_name}</p><p className="mt-2 text-sm leading-6" style={{ color: "var(--mk-ink-faint)" }}>HK Dijital’de reklam yönetimi, sosyal medya stratejisi ve ölçümleme odaklı dijital pazarlama içerikleri hazırlar.</p></MarketingCard>
            {related.length ? <MarketingCard className="p-5"><h2 className="text-sm font-black uppercase tracking-wide" style={{ color: "var(--mk-violet)" }}>İlgili Yazılar</h2><div className="mt-4 grid gap-3">{related.map((item) => <Link key={item.slug} href={`/blog/${item.slug}`} className="rounded-xl p-3 text-sm font-bold leading-6 transition hover:bg-[#7c3aed]/[0.06]" style={{ background: "var(--mk-bg-alt)", color: "var(--mk-ink)" }}>{item.title}</Link>)}</div></MarketingCard> : null}
          </aside>
        </article>
      </main>
    </PublicShell>
  );
}

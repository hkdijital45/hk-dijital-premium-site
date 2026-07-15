import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, Clock, UserRound } from "lucide-react";
import { JsonLd } from "@/components/public/JsonLd";
import { PublicShell } from "@/components/public/Shell";
import { PremiumCard } from "@/components/public/ui";
import { absoluteUrl } from "@/lib/metadata";
import { getPublicBlogPost, getPublicBlogPosts } from "@/lib/blog-seo";

type BlogDetailProps = { params: Promise<{ slug: string }> };

function headingId(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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
    return <Link key={`${href}-${index}`} href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="font-bold text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 hover:text-cyan-100">{label}</Link>;
  });
}

function BlogMarkdown({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="space-y-7 text-slate-200">
      {blocks.map((block, index) => {
        if (block.startsWith("# ")) return null;
        if (block.startsWith("## ")) {
          const label = block.replace(/^##\s+/, "");
          return <h2 key={index} id={headingId(label)} className="scroll-mt-28 text-2xl font-black tracking-tight text-white">{label}</h2>;
        }
        if (block.includes("\n- ")) {
          const lines = block.split("\n").filter(Boolean);
          const lead = lines.find((line) => !line.startsWith("- "));
          const items = lines.filter((line) => line.startsWith("- ")).map((line) => line.replace(/^- /, ""));
          return (
            <div key={index} className="rounded-[20px] border border-cyan-200/12 bg-cyan-300/5 p-5">
              {lead ? <p className="mb-3 leading-8 text-slate-200">{renderInline(lead)}</p> : null}
              <ul className="grid gap-2">{items.map((item) => <li key={item} className="leading-7 text-slate-300">• {renderInline(item)}</li>)}</ul>
            </div>
          );
        }
        return <p key={index} className="text-lg leading-9 text-slate-300">{renderInline(block)}</p>;
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
    title: {
      absolute: post.meta_title || post.title
    },
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
      <main className="bg-[#02040b] px-4 py-14 text-white sm:px-6 lg:px-8">
        <article className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <nav className="flex flex-wrap gap-2 text-sm text-slate-400" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-cyan-100">Ana Sayfa</Link><span>/</span>
              <Link href="/blog" className="hover:text-cyan-100">Blog</Link><span>/</span>
              <span className="text-slate-200">{post.category?.name || "Yazı"}</span>
            </nav>
            <header className="mt-8 rounded-[28px] border border-cyan-200/15 bg-gradient-to-br from-cyan-300/10 via-slate-900 to-yellow-300/10 p-6 sm:p-8">
              <p className="text-sm font-black uppercase tracking-[.18em] text-cyan-200">{post.category?.name || "Blog"}</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">{post.title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{post.excerpt}</p>
              <div className="mt-7 flex flex-wrap gap-4 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2"><UserRound size={16} /> {post.author_name}</span>
                <span className="inline-flex items-center gap-2"><CalendarDays size={16} /> {post.published_at ? new Date(post.published_at).toLocaleDateString("tr-TR") : "Yayında"}</span>
                <span className="inline-flex items-center gap-2"><Clock size={16} /> {post.reading_time} dk okuma</span>
              </div>
            </header>
            <div className="mt-10 rounded-[28px] border border-white/10 bg-white/[0.04] p-6 sm:p-8"><BlogMarkdown content={post.content} /></div>
            <section className="mt-10 rounded-[24px] border border-yellow-200/20 bg-yellow-300/10 p-6">
              <h2 className="text-2xl font-black text-white">Bu konuyu işletmeniz için değerlendirelim</h2>
              <p className="mt-3 max-w-2xl leading-7 text-slate-300">Reklam bütçenizi, kanal seçiminizi veya satışa dönüşmeyen kampanyalarınızı birlikte incelemek için kısa bir ön görüşme talep edebilirsiniz.</p>
              <Link href="/teklif-al" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-cyan-300 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-200">Ücretsiz Ön Görüşme <ArrowRight size={16} /></Link>
            </section>
          </div>
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            {headings.length ? <PremiumCard><h2 className="text-sm font-black uppercase tracking-[.18em] text-cyan-200">İçindekiler</h2><div className="mt-4 grid gap-3 text-sm text-slate-300">{headings.map((heading) => <a key={heading} href={`#${headingId(heading)}`} className="hover:text-cyan-100">{heading}</a>)}</div></PremiumCard> : null}
            <PremiumCard><h2 className="text-sm font-black uppercase tracking-[.18em] text-yellow-200">Yazar</h2><p className="mt-3 text-lg font-black text-white">{post.author_name}</p><p className="mt-2 text-sm leading-6 text-slate-400">HK Dijital’de reklam yönetimi, sosyal medya stratejisi ve ölçümleme odaklı dijital pazarlama içerikleri hazırlar.</p></PremiumCard>
            {related.length ? <PremiumCard><h2 className="text-sm font-black uppercase tracking-[.18em] text-cyan-200">İlgili Yazılar</h2><div className="mt-4 grid gap-3">{related.map((item) => <Link key={item.slug} href={`/blog/${item.slug}`} className="rounded-2xl bg-white/[0.05] p-3 text-sm font-bold leading-6 text-slate-200 hover:bg-white/[0.08]">{item.title}</Link>)}</div></PremiumCard> : null}
          </aside>
        </article>
      </main>
    </PublicShell>
  );
}

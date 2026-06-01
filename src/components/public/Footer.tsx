import Link from "next/link";
import type { SiteContent } from "@/lib/types";
import { Logo } from "./Logo";
import { SocialLinks } from "./SocialLinks";

export function Footer({ content }: { content: SiteContent }) {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-[#02040b]">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-35" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_.8fr_.8fr] lg:px-8">
        <div className="relative">
          <Logo content={content} footer />
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">{content.brand.slogan}</p>
          <p className="mt-5 text-xs leading-6 text-slate-500">
            Satış garantisi verilmez. Reklam bütçesi hizmet bedeline dahil değildir. Fiyatlara KDV dahil değildir.
          </p>
        </div>
        <div className="relative">
          <h2 className="text-sm font-bold uppercase tracking-[.22em] text-cyan-200">Sayfalar</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <Link href="/hizmetler">Hizmetler</Link>
            <Link href="/sertifikalar">Sertifikalar</Link>
            <Link href="/paketler">Paketler</Link>
            <Link href="/hk-intelligence">HK Intelligence</Link>
            <Link href="/teklif-al">Teklif Al</Link>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-sm font-bold uppercase tracking-[.22em] text-cyan-200">İletişim</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p>{content.contact.address}</p>
            <a href={`mailto:${content.contact.email}`}>{content.contact.email}</a>
            <p>{content.contact.phone}</p>
          </div>
          <SocialLinks content={content} />
        </div>
      </div>
    </footer>
  );
}

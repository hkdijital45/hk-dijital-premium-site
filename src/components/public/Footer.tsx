import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { SiteContent } from "@/lib/types";
import { Logo } from "./Logo";
import { SocialLinks } from "./SocialLinks";
import { platformMarks } from "./PlatformIcons";

export function Footer({ content }: { content: SiteContent }) {
  const phoneHref = content.contact.phone ? `tel:${content.contact.phone.replace(/[^\d+]/g, "")}` : "";
  return (
    <footer className="cinematic-footer relative border-t border-white/10">
      <div className="relative mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 border-b border-white/10 pb-10 opacity-80">
          {platformMarks.map(({ key, label, Icon }) => (
            <div key={key} className="flex items-center gap-2">
              <Icon className="size-6" />
              <span className="text-xs font-bold text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_.8fr_.8fr_.8fr_.9fr] lg:px-8">
        <div className="relative">
          <Logo content={content} footer />
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400">{content.brand.footerDescription || content.brand.slogan}</p>
          <p className="mt-5 text-xs leading-6 text-slate-500">
            Satış garantisi verilmez. Reklam bütçesi hizmet bedeline dahil değildir. Fiyatlara KDV dahil değildir.
          </p>
        </div>
        <div className="relative">
          <h2 className="text-sm font-bold uppercase tracking-[.22em] text-[#c4b5fd]">Hizmetler</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <Link className="transition hover:text-white" href="/hizmetler/meta-reklam-yonetimi">Meta Reklam Yönetimi</Link>
            <Link className="transition hover:text-white" href="/hizmetler/google-ads-yonetimi">Google Ads Yönetimi</Link>
            <Link className="transition hover:text-white" href="/hizmetler/sosyal-medya-yonetimi">Sosyal Medya Yönetimi</Link>
            <Link className="transition hover:text-white" href="/hizmetler/dijital-pazarlama-danismanligi">Dijital Pazarlama Danışmanlığı</Link>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-sm font-bold uppercase tracking-[.22em] text-[#c4b5fd]">HK Dijital</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <Link className="transition hover:text-white" href="/hakkimda">Hakkımızda</Link>
            <Link className="transition hover:text-white" href="/paketler">Paketler</Link>
            <Link className="transition hover:text-white" href="/blog">Blog</Link>
            <Link className="transition hover:text-white" href="/iletisim">İletişim</Link>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-sm font-bold uppercase tracking-[.22em] text-[#c4b5fd]">Yasal</h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-300">
            <Link className="transition hover:text-white" href="/gizlilik-politikasi">Gizlilik Politikası</Link>
            <Link className="transition hover:text-white" href="/kullanim-sartlari">Kullanım Koşulları</Link>
            <Link className="transition hover:text-white" href="/veri-silme">Veri Silme Talimatları</Link>
          </div>
        </div>
        <div className="relative">
          <h2 className="text-sm font-bold uppercase tracking-[.22em] text-[#c4b5fd]">İletişim</h2>
          <div className="mt-4 space-y-2 text-sm text-slate-300">
            <p>{content.contact.address}</p>
            <a className="block transition hover:text-white" href={`mailto:${content.contact.email}`}>{content.contact.email}</a>
            {phoneHref ? <a className="block transition hover:text-white" href={phoneHref}>{content.contact.phone}</a> : <p>{content.contact.phone}</p>}
          </div>
          <SocialLinks content={content} />
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {content.brand.companyName}. Tüm hakları saklıdır.</p>
          <Link href="/teklif-al" className="inline-flex items-center gap-1.5 font-bold text-[#c4b5fd] transition hover:text-white">
            Ücretsiz analiz talep edin <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </footer>
  );
}

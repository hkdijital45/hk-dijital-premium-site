"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, ChevronDown, Menu, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SiteContent } from "@/lib/types";
import { trackMetaCtaClick } from "@/lib/meta-pixel";
import { Logo } from "./Logo";

const serviceLinks = [
  ["Meta Reklam Yönetimi", "/hizmetler/meta-reklam-yonetimi"],
  ["Google Ads Yönetimi", "/hizmetler/google-ads-yonetimi"],
  ["Sosyal Medya Yönetimi", "/hizmetler/sosyal-medya-yonetimi"],
  ["Dijital Pazarlama Danışmanlığı", "/hizmetler/dijital-pazarlama-danismanligi"],
  ["Ölçümleme ve Raporlama", "/hizmetler#raporlama"],
  ["Web Sitesi ve Dönüşüm Danışmanlığı", "/hizmetler#web-donusum"]
];

const mainNav = [
  ["Ana Sayfa", "/"],
  ["Paketler", "/paketler"],
  ["Nasıl Çalışıyoruz", "/#process"],
  ["Hakkımızda", "/hakkimda"],
  ["Blog", "/blog"],
  ["İletişim", "/iletisim"]
];

export function Header({ content }: { content: SiteContent }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const whatsappUrl = content.socials?.whatsapp || (content.contact?.whatsappNumber ? `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}` : "/iletisim");

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <header className="relative z-50 bg-[#02040b] px-4 py-4 sm:px-6 lg:px-8">
      <div ref={menuRef} className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[22px] border border-[#4fa8f0]/20 bg-[#030712]/88 px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,.28)] backdrop-blur-2xl transition duration-300 hover:border-[#4fa8f0]/35 sm:px-5">
        <Link href="/" aria-label="HK Dijital ana sayfa" className="impact-logo rounded-[8px] transition hover:scale-[1.02]">
          <Logo content={content} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <Link href="/" className={`nav-impact-link rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#4fa8f0] ${isActive("/") ? "bg-[#2f5bff] text-white shadow-[0_0_28px_rgba(47,91,255,.35)]" : "text-slate-300"}`}>
            Ana Sayfa
          </Link>
          <div className="group relative">
            <Link href="/hizmetler" className={`nav-impact-link inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#4fa8f0] ${isActive("/hizmetler") ? "bg-[#2f5bff] text-white shadow-[0_0_28px_rgba(47,91,255,.35)]" : "text-slate-300"}`}>
              Hizmetler <ChevronDown size={15} aria-hidden="true" />
            </Link>
            <div className="invisible absolute left-0 top-full z-50 mt-3 w-80 translate-y-2 rounded-[18px] border border-[#4fa8f0]/20 bg-[#07101f]/96 p-2 opacity-0 shadow-[0_24px_80px_rgba(0,0,0,.35)] backdrop-blur-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              {serviceLinks.map(([label, href]) => (
                <Link key={`${href}-${label}`} href={href} className="block rounded-[12px] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-[#2f5bff]/10 hover:text-[#4fa8f0] focus:bg-[#2f5bff]/10 focus:text-[#4fa8f0] focus:outline-none">
                  {label}
                </Link>
              ))}
            </div>
          </div>
          {mainNav.slice(1).map(([label, href]) => (
            <Link key={href} href={href} className={`nav-impact-link rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#4fa8f0] ${isActive(href) ? "bg-[#2f5bff] text-white shadow-[0_0_28px_rgba(47,91,255,.35)]" : "text-slate-300"}`}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => trackMetaCtaClick("Header WhatsApp", whatsappUrl)} className="impact-btn inline-flex min-h-11 items-center gap-2 rounded-full border border-[#25D366]/40 bg-white/[0.04] px-4 text-sm font-bold text-white transition hover:border-[#25D366]/70 hover:bg-[#25D366]/10">
            <MessageCircle size={17} className="text-[#25D366]" /> WhatsApp
          </a>
          <Link href="/teklif-al" onClick={() => trackMetaCtaClick("Header Paketini Bul", "/teklif-al")} className="impact-btn inline-flex min-h-11 items-center gap-2 rounded-full border border-[#4fa8f0]/40 bg-gradient-to-r from-[#2f5bff] to-[#4fa8f0] px-5 text-sm font-bold text-white shadow-[0_0_42px_rgba(47,91,255,.38)] transition hover:-translate-y-0.5 hover:brightness-110">
            <CalendarCheck size={17} /> Paketini Bul
          </Link>
        </div>

        <button className="impact-btn grid size-11 place-items-center rounded-full border border-white/10 text-white lg:hidden" onClick={() => setOpen((value) => !value)} aria-label={open ? "Menüyü kapat" : "Menüyü aç"} aria-expanded={open} aria-controls="mobile-public-menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div id="mobile-public-menu" className="animate-hard-drop mx-auto mt-3 max-h-[calc(100svh-112px)] max-w-7xl overflow-y-auto rounded-[18px] border border-white/10 bg-[#070a14]/95 px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-2xl lg:hidden">
          <nav className="grid gap-2">
            <Link href="/" onClick={() => setOpen(false)} className={`rounded-2xl px-4 py-3 text-base font-semibold transition hover:bg-white/10 hover:text-[#4fa8f0] ${isActive("/") ? "bg-[#2f5bff] text-white" : "text-slate-100"}`}>
              Ana Sayfa
            </Link>
            <Link href="/hizmetler" onClick={() => setOpen(false)} className={`rounded-2xl px-4 py-3 text-base font-semibold transition hover:bg-white/10 hover:text-[#4fa8f0] ${isActive("/hizmetler") ? "bg-[#2f5bff] text-white" : "text-slate-100"}`}>
              Hizmetler
            </Link>
            {serviceLinks.map(([label, href]) => (
              <Link key={`${href}-${label}`} href={href} onClick={() => setOpen(false)} className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-[#4fa8f0]">
                {label}
              </Link>
            ))}
            {mainNav.slice(1).map(([label, href]) => (
              <Link key={`${href}-${label}`} href={href} onClick={() => setOpen(false)} className={`rounded-2xl px-4 py-3 text-base font-semibold transition hover:bg-white/10 hover:text-[#4fa8f0] ${isActive(href) ? "bg-[#2f5bff] text-white" : "text-slate-100"}`}>
                {label}
              </Link>
            ))}
            <Link href="/teklif-al" onClick={() => { trackMetaCtaClick("Mobil Paketini Bul", "/teklif-al"); setOpen(false); }} className="impact-btn rounded-2xl bg-gradient-to-r from-[#2f5bff] to-[#4fa8f0] px-4 py-3 text-base font-bold text-white shadow-[0_0_32px_rgba(47,91,255,.32)]">
              <span className="inline-flex items-center gap-2"><CalendarCheck size={17} /> Paketini Bul</span>
            </Link>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => { trackMetaCtaClick("Mobil WhatsApp", whatsappUrl); setOpen(false); }} className="impact-btn rounded-2xl border border-[#25D366]/40 bg-white/[0.04] px-4 py-3 text-base font-bold text-white">
              <span className="inline-flex items-center gap-2"><MessageCircle size={17} className="text-[#25D366]" /> WhatsApp&apos;tan Görüş</span>
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChevronDown, LogIn, Menu, X } from "lucide-react";
import { useState } from "react";
import type { SiteContent } from "@/lib/types";
import { trackMetaCtaClick } from "@/lib/meta-pixel";
import { Logo } from "./Logo";

const navGroups = [
  {
    label: "Çözümler",
    items: [
      ["Reklam Yönetimi", "/hizmetler"],
      ["Sosyal Medya Yönetimi", "/hizmetler#sosyal-medya"],
      ["AI İçerik & Kreatif", "/hk-intelligence"],
      ["Raporlama & Analiz", "/hk-intelligence#raporlama"],
      ["Web & Dönüşüm Takibi", "/hizmetler#web"]
    ]
  },
  {
    label: "Entegrasyonlar",
    items: [
      ["Meta", "/hk-intelligence#entegrasyonlar"],
      ["Instagram", "/hk-intelligence#entegrasyonlar"],
      ["TikTok", "/hk-intelligence#entegrasyonlar"],
      ["Google Ads", "/hk-intelligence#entegrasyonlar"],
      ["Google Analytics", "/hk-intelligence#entegrasyonlar"],
      ["Search Console", "/hk-intelligence#entegrasyonlar"]
    ]
  },
  {
    label: "Kaynaklar",
    items: [
      ["Blog", "/hk-intelligence#kaynaklar"],
      ["Sık Sorulan Sorular", "/iletisim#sss"],
      ["Sistem Rehberi", "/hk-intelligence#rehber"],
      ["İletişim", "/iletisim"]
    ]
  }
];

const flatNav = [
  ["Paketler", "/paketler"]
];

export function Header({ content }: { content: SiteContent }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="relative z-50 bg-[#02040b] px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[22px] border border-cyan-200/14 bg-[#030712]/82 px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,.28)] backdrop-blur-2xl transition duration-300 hover:border-cyan-200/24 sm:px-5">
        <Link href="/" aria-label="HK Dijital ana sayfa" className="impact-logo rounded-[8px] transition hover:scale-[1.02]">
          <Logo content={content} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navGroups.map((group) => (
            <div key={group.label} className="group relative">
              <button type="button" className="nav-impact-link inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold text-slate-300 transition focus:outline-none focus:ring-2 focus:ring-cyan-300">
                {group.label} <ChevronDown size={15} />
              </button>
              <div className="invisible absolute left-0 top-full z-50 mt-3 w-72 translate-y-2 rounded-[18px] border border-cyan-200/14 bg-[#07101f]/96 p-2 opacity-0 shadow-[0_24px_80px_rgba(0,0,0,.35)] backdrop-blur-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                {group.items.map(([label, href]) => (
                  <Link key={`${group.label}-${href}-${label}`} href={href} className="block rounded-[12px] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-cyan-300/10 hover:text-cyan-100">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {flatNav.map(([label, href]) => (
            <Link key={href} href={href} className={`nav-impact-link rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-300 ${pathname === href ? "bg-cyan-300 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,.24)]" : "text-slate-300"}`}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/teklif-al" onClick={() => trackMetaCtaClick("Header Görüşme Planla", "/teklif-al")} className="impact-btn inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-200/40 bg-cyan-300 px-5 text-sm font-black text-slate-950 shadow-[0_0_42px_rgba(18,217,255,.38)] transition hover:-translate-y-0.5 hover:bg-cyan-200">
            <Bot size={17} /> Teklif Al / Görüşme Planla
          </Link>
          <Link href="/digital-center" onClick={() => trackMetaCtaClick("Header Digital Center", "/digital-center")} className="impact-btn inline-flex min-h-11 items-center gap-2 rounded-full border border-yellow-200/40 bg-yellow-300 px-5 text-sm font-black text-slate-950 shadow-[0_0_32px_rgba(250,204,21,.24)] transition hover:-translate-y-0.5 hover:bg-yellow-200">
            <LogIn size={17} /> Digital Center
          </Link>
        </div>

        <button className="impact-btn grid size-11 place-items-center rounded-full border border-white/10 text-white lg:hidden" onClick={() => setOpen((value) => !value)} aria-label="Menüyü aç veya kapat">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="animate-hard-drop mx-auto mt-3 max-w-7xl rounded-[18px] border border-white/10 bg-[#070a14]/95 px-4 py-4 shadow-[0_20px_70px_rgba(0,0,0,.35)] backdrop-blur-2xl lg:hidden">
          <nav className="grid gap-2">
            {[...navGroups.flatMap((group) => group.items), ...flatNav].map(([label, href]) => (
              <Link key={`${href}-${label}`} href={href} onClick={() => setOpen(false)} className={`rounded-2xl px-4 py-3 text-base font-semibold transition hover:bg-white/10 hover:text-cyan-100 ${pathname === href ? "bg-cyan-300 text-slate-950" : "text-slate-100"}`}>
                {label}
              </Link>
            ))}
            <Link href="/teklif-al" onClick={() => { trackMetaCtaClick("Mobil Paket Öneri Robotu", "/teklif-al"); setOpen(false); }} className="impact-btn rounded-2xl bg-cyan-300 px-4 py-3 text-base font-black text-slate-950 shadow-[0_0_32px_rgba(18,217,255,.28)]">
              <span className="inline-flex items-center gap-2"><Bot size={17} /> Teklif Al / Görüşme Planla</span>
            </Link>
            <Link href="/digital-center" onClick={() => { trackMetaCtaClick("Mobil Digital Center", "/digital-center"); setOpen(false); }} className="impact-btn rounded-2xl bg-yellow-300 px-4 py-3 text-base font-black text-slate-950">
              <span className="inline-flex items-center gap-2"><LogIn size={17} /> Digital Center</span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LogIn, Menu, X } from "lucide-react";
import { useState } from "react";
import type { SiteContent } from "@/lib/types";
import { Logo } from "./Logo";

const nav = [
  ["Ana Sayfa", "/"],
  ["Hakkımda", "/hakkimda"],
  ["Hizmetler", "/hizmetler"],
  ["Paketler", "/paketler"],
  ["HK Intelligence", "/hk-intelligence"],
  ["İletişim", "/iletisim"]
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
          {nav.map(([label, href]) => (
            <Link key={href} href={href} className={`nav-impact-link rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-300 ${pathname === href ? "bg-cyan-300 text-slate-950 shadow-[0_0_28px_rgba(34,211,238,.24)]" : "text-slate-300"}`}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/teklif-al" className="impact-btn inline-flex min-h-11 items-center gap-2 rounded-full border border-cyan-200/40 bg-cyan-300 px-5 text-sm font-black text-slate-950 shadow-[0_0_42px_rgba(18,217,255,.38)] transition hover:-translate-y-0.5 hover:bg-cyan-200">
            <Bot size={17} /> Paket Öneri Robotu
          </Link>
          <Link href="/digital-center" className="impact-btn inline-flex min-h-11 items-center gap-2 rounded-full border border-yellow-200/40 bg-yellow-300 px-5 text-sm font-black text-slate-950 shadow-[0_0_32px_rgba(250,204,21,.24)] transition hover:-translate-y-0.5 hover:bg-yellow-200">
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
            {nav.map(([label, href]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={`rounded-2xl px-4 py-3 text-base font-semibold transition hover:bg-white/10 hover:text-cyan-100 ${pathname === href ? "bg-cyan-300 text-slate-950" : "text-slate-100"}`}>
                {label}
              </Link>
            ))}
            <Link href="/teklif-al" onClick={() => setOpen(false)} className="impact-btn rounded-2xl bg-cyan-300 px-4 py-3 text-base font-black text-slate-950 shadow-[0_0_32px_rgba(18,217,255,.28)]">
              <span className="inline-flex items-center gap-2"><Bot size={17} /> Paket Öneri Robotu</span>
            </Link>
            <Link href="/digital-center" onClick={() => setOpen(false)} className="impact-btn rounded-2xl bg-yellow-300 px-4 py-3 text-base font-black text-slate-950">
              <span className="inline-flex items-center gap-2"><LogIn size={17} /> Digital Center</span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

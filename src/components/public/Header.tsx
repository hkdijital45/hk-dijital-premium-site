"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const whatsappUrl = content.socials?.whatsapp || (content.contact?.whatsappNumber ? `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}` : "/iletisim");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hidden mobile trigger for the Secret Access Control Center: 5 rapid taps
  // on the real logo within ~2.5s opens the modal (SecretAccessGate, mounted
  // once in the root layout — communicated via a CustomEvent so this
  // component doesn't need to know it exists). Touch-only by design
  // (navigator.maxTouchPoints > 0) so desktop mouse clicks never engage this
  // logic and the logo behaves as a completely normal link there.
  // PRESERVED EXACTLY across the visual redesign — do not change this logic.
  const logoTapRef = useRef<{ count: number; timer: ReturnType<typeof setTimeout> | null }>({ count: 0, timer: null });
  function handleLogoClick(event: React.MouseEvent) {
    if (typeof navigator === "undefined" || !navigator.maxTouchPoints) return; // desktop: normal Link navigation
    event.preventDefault();
    logoTapRef.current.count += 1;
    if (logoTapRef.current.timer) clearTimeout(logoTapRef.current.timer);
    if (logoTapRef.current.count >= 5) {
      logoTapRef.current.count = 0;
      window.dispatchEvent(new CustomEvent("hk-secret-access-open"));
      return;
    }
    logoTapRef.current.timer = setTimeout(() => {
      const finalCount = logoTapRef.current.count;
      logoTapRef.current.count = 0;
      if (finalCount > 0) router.push("/");
    }, 2500);
  }

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
    <header className="relative z-50 px-4 py-4 sm:px-6 lg:px-8" style={{ background: "var(--mk-bg)" }}>
      <div
        ref={menuRef}
        className={`marketing-nav mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[22px] px-4 py-3 transition-all duration-300 sm:px-5 ${scrolled ? "marketing-nav-scrolled py-2.5" : ""}`}
      >
        <Link href="/" aria-label="HK Dijital ana sayfa" onClick={handleLogoClick} className="impact-logo rounded-[8px] transition hover:scale-[1.02]">
          <Logo content={content} />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <Link href="/" className={`marketing-nav-link rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/50 ${isActive("/") ? "marketing-nav-link-active" : ""}`}>
            Ana Sayfa
          </Link>
          <div className="group relative">
            <Link href="/hizmetler" className={`marketing-nav-link inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/50 ${isActive("/hizmetler") ? "marketing-nav-link-active" : ""}`}>
              Hizmetler <ChevronDown size={15} aria-hidden="true" />
            </Link>
            <div className="invisible absolute left-0 top-full z-50 mt-3 w-80 translate-y-2 rounded-[18px] border p-2 opacity-0 shadow-[0_24px_80px_rgba(15,16,36,.14)] backdrop-blur-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100" style={{ borderColor: "var(--mk-border)", background: "rgba(255,255,255,.98)" }}>
              {serviceLinks.map(([label, href]) => (
                <Link key={`${href}-${label}`} href={href} className="block rounded-[12px] px-4 py-3 text-sm font-bold transition hover:bg-[#7c3aed]/[0.06]" style={{ color: "var(--mk-ink)" }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
          {mainNav.slice(1).map(([label, href]) => (
            <Link key={href} href={href} className={`marketing-nav-link rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/50 ${isActive(href) ? "marketing-nav-link-active" : ""}`}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => trackMetaCtaClick("Header WhatsApp", whatsappUrl)} className="impact-btn inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition hover:border-[#25D366]/60" style={{ borderColor: "var(--mk-border-strong)", color: "var(--mk-ink)" }}>
            <MessageCircle size={17} className="text-[#25D366]" /> WhatsApp
          </a>
          <Link href="/teklif-al" onClick={() => trackMetaCtaClick("Header Paketini Bul", "/teklif-al")} className="marketing-btn marketing-btn-primary min-h-11">
            <CalendarCheck size={17} /> Paketini Bul
          </Link>
        </div>

        <button className="grid size-11 place-items-center rounded-full border transition lg:hidden" style={{ borderColor: "var(--mk-border-strong)", color: "var(--mk-ink)" }} onClick={() => setOpen((value) => !value)} aria-label={open ? "Menüyü kapat" : "Menüyü aç"} aria-expanded={open} aria-controls="mobile-public-menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div id="mobile-public-menu" className="animate-hard-drop mx-auto mt-3 max-h-[calc(100svh-112px)] max-w-7xl overflow-y-auto rounded-[18px] border px-4 py-4 shadow-[0_20px_70px_rgba(15,16,36,.14)] backdrop-blur-2xl lg:hidden" style={{ borderColor: "var(--mk-border)", background: "rgba(255,255,255,.98)" }}>
          <nav className="grid gap-2">
            <Link href="/" onClick={() => setOpen(false)} className={`rounded-2xl px-4 py-3 text-base font-semibold transition ${isActive("/") ? "marketing-nav-link-active" : ""}`} style={{ color: isActive("/") ? undefined : "var(--mk-ink)" }}>
              Ana Sayfa
            </Link>
            <Link href="/hizmetler" onClick={() => setOpen(false)} className={`rounded-2xl px-4 py-3 text-base font-semibold transition ${isActive("/hizmetler") ? "marketing-nav-link-active" : ""}`} style={{ color: isActive("/hizmetler") ? undefined : "var(--mk-ink)" }}>
              Hizmetler
            </Link>
            {serviceLinks.map(([label, href]) => (
              <Link key={`${href}-${label}`} href={href} onClick={() => setOpen(false)} className="rounded-2xl border px-4 py-3 text-sm font-semibold transition" style={{ borderColor: "var(--mk-border)", color: "var(--mk-ink-soft)" }}>
                {label}
              </Link>
            ))}
            {mainNav.slice(1).map(([label, href]) => (
              <Link key={`${href}-${label}`} href={href} onClick={() => setOpen(false)} className={`rounded-2xl px-4 py-3 text-base font-semibold transition ${isActive(href) ? "marketing-nav-link-active" : ""}`} style={{ color: isActive(href) ? undefined : "var(--mk-ink)" }}>
                {label}
              </Link>
            ))}
            <Link href="/teklif-al" onClick={() => { trackMetaCtaClick("Mobil Paketini Bul", "/teklif-al"); setOpen(false); }} className="marketing-btn marketing-btn-primary mt-1 w-full">
              <CalendarCheck size={17} /> Paketini Bul
            </Link>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => { trackMetaCtaClick("Mobil WhatsApp", whatsappUrl); setOpen(false); }} className="marketing-btn marketing-btn-secondary w-full">
              <MessageCircle size={17} className="text-[#25D366]" /> WhatsApp&apos;tan Görüş
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}

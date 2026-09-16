"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCheck, ChevronDown, Menu, MessageCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  const [navHover, setNavHover] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const reduced = useReducedMotion();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  const whatsappUrl = content.socials?.whatsapp || (content.contact?.whatsappNumber ? `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}` : "/iletisim");

  // Desktop nav "sliding pill" indicator (adapted from
  // docs/animation-reference/17-nav-menu.md): a single shared-layout
  // motion.span slides between whichever link is hovered/focused, falling
  // back to the actual active route. Reduced-motion only swaps the spring
  // transition's timing (duration: 0), never the element tree itself —
  // same safe pattern as MarketingReveal, so no hydration risk.
  const desktopNavHrefs = ["/", "/hizmetler", ...mainNav.slice(1).map(([, href]) => href)];
  const activeHref = desktopNavHrefs.find((href) => isActive(href)) ?? null;
  const pillHref = navHover ?? activeHref;
  const pillTransition = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.7 };

  function navLink(href: string, label: ReactNode, extra?: { chevron?: boolean }) {
    const showPill = pillHref === href;
    return (
      <Link
        href={href}
        onMouseEnter={() => setNavHover(href)}
        onMouseLeave={() => setNavHover(null)}
        onFocus={() => setNavHover(href)}
        onBlur={() => setNavHover(null)}
        className={`marketing-nav-link relative inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/50 ${showPill ? "marketing-nav-link-active" : ""}`}
      >
        {showPill && <motion.span layoutId="nav-pill" className="marketing-nav-indicator" transition={pillTransition} />}
        <span className="relative z-10 inline-flex items-center gap-1">
          {label}
          {extra?.chevron && <ChevronDown size={15} aria-hidden="true" />}
        </span>
      </Link>
    );
  }

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

  // Mobile full-screen-panel items, flattened into one ordered list so the
  // blur/stagger entrance (reference 17 item 3) can apply a single
  // continuous index across static links + the two mapped groups, instead
  // of three separately-staggered blocks.
  const mobileRows: Array<{ key: string; node: ReactNode }> = [
    { key: "home", node: (
      <Link href="/" onClick={() => setOpen(false)} className={`block rounded-2xl px-4 py-3 text-base font-semibold transition ${isActive("/") ? "marketing-nav-link-active" : ""}`} style={{ color: isActive("/") ? undefined : "var(--mk-ink)" }}>
        Ana Sayfa
      </Link>
    ) },
    { key: "hizmetler", node: (
      <Link href="/hizmetler" onClick={() => setOpen(false)} className={`block rounded-2xl px-4 py-3 text-base font-semibold transition ${isActive("/hizmetler") ? "marketing-nav-link-active" : ""}`} style={{ color: isActive("/hizmetler") ? undefined : "var(--mk-ink)" }}>
        Hizmetler
      </Link>
    ) },
    ...serviceLinks.map(([label, href]) => ({
      key: `svc-${href}`,
      node: (
        <Link href={href} onClick={() => setOpen(false)} className="block rounded-2xl border px-4 py-3 text-sm font-semibold transition" style={{ borderColor: "var(--mk-border)", color: "var(--mk-ink-soft)" }}>
          {label}
        </Link>
      )
    })),
    ...mainNav.slice(1).map(([label, href]) => ({
      key: `main-${href}`,
      node: (
        <Link href={href} onClick={() => setOpen(false)} className={`block rounded-2xl px-4 py-3 text-base font-semibold transition ${isActive(href) ? "marketing-nav-link-active" : ""}`} style={{ color: isActive(href) ? undefined : "var(--mk-ink)" }}>
          {label}
        </Link>
      )
    })),
    { key: "cta-primary", node: (
      <Link href="/teklif-al" onClick={() => { trackMetaCtaClick("Mobil Paketini Bul", "/teklif-al"); setOpen(false); }} className="marketing-btn marketing-btn-primary mt-1 w-full">
        <CalendarCheck size={17} /> Paketini Bul
      </Link>
    ) },
    { key: "cta-whatsapp", node: (
      <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => { trackMetaCtaClick("Mobil WhatsApp", whatsappUrl); setOpen(false); }} className="marketing-btn marketing-btn-secondary w-full">
        <MessageCircle size={17} className="text-[#25D366]" /> WhatsApp&apos;tan Görüş
      </a>
    ) }
  ];

  return (
    <motion.header
      className="relative z-50 px-4 py-4 sm:px-6 lg:px-8"
      style={{ background: "var(--mk-bg)" }}
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: reduced ? 0.01 : 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div
        ref={menuRef}
        className={`marketing-nav relative mx-auto max-w-7xl rounded-[22px] transition-all duration-300 ${scrolled ? "marketing-nav-scrolled" : ""}`}
      >
        <span className="marketing-nav-aurora" aria-hidden="true" />
        <div className={`relative z-10 flex items-center justify-between gap-4 px-4 py-3 sm:px-5 ${scrolled ? "py-2.5" : ""}`}>
          <Link href="/" aria-label="HK Dijital ana sayfa" onClick={handleLogoClick} className="impact-logo rounded-[8px] transition hover:scale-[1.02]">
            <Logo content={content} />
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLink("/", "Ana Sayfa")}
            <div className="group relative">
              {navLink("/hizmetler", "Hizmetler", { chevron: true })}
              <div className="invisible absolute left-0 top-full z-50 mt-3 w-80 translate-y-2 rounded-[18px] border p-2 opacity-0 shadow-[0_24px_80px_rgba(15,16,36,.14)] backdrop-blur-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100" style={{ borderColor: "var(--mk-border)", background: "rgba(255,255,255,.98)" }}>
                {serviceLinks.map(([label, href]) => (
                  <Link key={`${href}-${label}`} href={href} className="block rounded-[12px] px-4 py-3 text-sm font-bold transition hover:bg-[#7c3aed]/[0.06]" style={{ color: "var(--mk-ink)" }}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
            {mainNav.slice(1).map(([label, href]) => <span key={href}>{navLink(href, label)}</span>)}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <a href={whatsappUrl} target="_blank" rel="noreferrer" onClick={() => trackMetaCtaClick("Header WhatsApp", whatsappUrl)} className="impact-btn inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition hover:border-[#25D366]/60" style={{ borderColor: "var(--mk-border-strong)", color: "var(--mk-ink)" }}>
              <MessageCircle size={17} className="text-[#25D366]" /> WhatsApp
            </a>
            <Link href="/teklif-al" onClick={() => trackMetaCtaClick("Header Paketini Bul", "/teklif-al")} className="marketing-btn marketing-btn-primary marketing-aurora-btn min-h-11">
              <CalendarCheck size={17} /> Paketini Bul
            </Link>
          </div>

          <button className="grid size-11 place-items-center rounded-full border transition lg:hidden" style={{ borderColor: "var(--mk-border-strong)", color: "var(--mk-ink)" }} onClick={() => setOpen((value) => !value)} aria-label={open ? "Menüyü kapat" : "Menüyü aç"} aria-expanded={open} aria-controls="mobile-public-menu">
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-public-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.2 } }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="mx-auto mt-3 max-h-[calc(100svh-112px)] max-w-7xl overflow-y-auto rounded-[18px] border px-4 py-4 shadow-[0_20px_70px_rgba(15,16,36,.14)] backdrop-blur-2xl lg:hidden"
            style={{ borderColor: "var(--mk-border)", background: "rgba(255,255,255,.98)" }}
          >
            <nav className="grid gap-2">
              {mobileRows.map((row, index) => (
                <motion.div
                  key={row.key}
                  initial={{ opacity: 0, y: 22, filter: "blur(10px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: reduced ? 0.01 : 0.5, delay: reduced ? 0 : 0.05 + index * 0.04, ease: [0.16, 1, 0.3, 1] }}
                >
                  {row.node}
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

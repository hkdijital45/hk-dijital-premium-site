"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Phone, ArrowUp } from "lucide-react";
import { trackMetaCtaClick } from "@/lib/meta-pixel";

/**
 * Floating contact dock — adapted from
 * docs/animation-reference/15-floating-contact-dock.md, elevating the
 * previous single WhatsApp button into a small real-channel stack. Only
 * ever shows channels that actually exist in content (same convention
 * Footer.tsx already uses for the phone number: render if truthy, no
 * fabricated channels). The "scroll to top" item is a UI utility, not a
 * contact channel, so it carries no real-data constraint.
 */
export function ContactDock({ whatsappUrl, phoneHref, phoneLabel }: { whatsappUrl: string; phoneHref: string; phoneLabel: string }) {
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 900);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!whatsappUrl) return null;

  return (
    <div className="marketing-contact-dock">
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Sayfa başına dön"
          className="marketing-dock-item grid size-11 place-items-center rounded-full border border-white/10 bg-[#14132b] text-white"
        >
          <ArrowUp size={17} />
        </button>
      )}
      {phoneHref && (
        <a
          href={phoneHref}
          onClick={() => trackMetaCtaClick("Contact Dock Telefon", phoneHref)}
          aria-label={`Telefon: ${phoneLabel}`}
          title={phoneLabel}
          className="marketing-dock-item grid size-11 place-items-center rounded-full border border-[#7c3aed]/40 bg-white text-[#7c3aed]"
        >
          <Phone size={17} />
        </a>
      )}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackMetaCtaClick("Contact Dock WhatsApp", whatsappUrl)}
        aria-label="WhatsApp üzerinden iletişime geçin"
        className="marketing-dock-item impact-btn inline-flex min-h-12 items-center gap-2 rounded-full border border-[#25D366]/50 bg-[#25D366] px-5 py-3 text-sm font-black text-white shadow-[0_0_44px_rgba(37,211,102,.35)] transition hover:-translate-y-1 hover:bg-[#20bd5b]"
      >
        <MessageCircle size={18} /> WhatsApp
      </a>
    </div>
  );
}

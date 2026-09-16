"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Hero scroll hint — adapted from
 * docs/animation-reference/03-scroll-hint.md. Appears once idle near the
 * top of the page, disappears on the very first scroll. The idle bob
 * itself is a pure CSS loop (`.marketing-scroll-hint`, already reduced-
 * motion-gated in globals.css); this component only owns the show/hide
 * boolean, so there is nothing here that could mismatch between server
 * and client render (it starts `true` on both, exactly the same markup).
 */
export function ScrollHint() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 40) setVisible(false);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 sm:block" aria-hidden="true">
      <span className="marketing-scroll-hint">
        <span className="text-[10px] font-black uppercase tracking-[.2em]">Kaydırın</span>
        <ChevronDown size={16} />
      </span>
    </div>
  );
}

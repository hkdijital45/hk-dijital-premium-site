"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type PublicTabItem = {
  id: string;
  label: string;
};

export function PublicTopTabs({ items }: { items: PublicTabItem[] }) {
  const [active, setActive] = useState(items[0]?.id || "");
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeIndex = useMemo(() => Math.max(0, items.findIndex((item) => item.id === active)), [active, items]);

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter(Boolean) as HTMLElement[];
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-26% 0px -55% 0px", threshold: [0.16, 0.32, 0.48, 0.64] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const parent = containerRef.current;
        const button = buttonRefs.current[active];
        if (!parent || !button) return;
        const parentRect = parent.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        setIndicator({ left: buttonRect.left - parentRect.left + parent.scrollLeft, width: buttonRect.width });
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [active, items]);

  function scrollTo(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="public-top-tabs sticky top-[72px] z-40 mx-auto -mb-8 w-full px-3 pt-3 sm:px-6 lg:top-[76px]">
      <div className="mx-auto max-w-5xl rounded-full border border-cyan-200/15 bg-[#030712]/78 p-1.5 shadow-[0_16px_60px_rgba(0,0,0,.32)] backdrop-blur-2xl">
        <div ref={containerRef} className="premium-scrollbar relative flex gap-1 overflow-x-auto">
          <span
            className="pointer-events-none absolute bottom-1.5 top-1.5 rounded-full bg-cyan-300 shadow-[0_0_34px_rgba(34,211,238,.34)] transition-all duration-300 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
          />
          {items.map((item, index) => {
            const selected = item.id === active;
            return (
              <button
                key={item.id}
                ref={(node) => { buttonRefs.current[item.id] = node; }}
                type="button"
                onClick={() => scrollTo(item.id)}
                className={`relative z-10 shrink-0 rounded-full px-4 py-2.5 text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-cyan-300 sm:text-sm ${selected ? "text-slate-950" : "text-slate-300 hover:text-white"}`}
                aria-current={selected ? "true" : undefined}
              >
                <span className="mr-2 text-[10px] opacity-70">{String(index + 1).padStart(2, "0")}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mx-auto mt-2 w-fit rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-100/80 md:hidden">
        Aktif bölüm: {items[activeIndex]?.label || "Ana Sayfa"}
      </p>
    </div>
  );
}

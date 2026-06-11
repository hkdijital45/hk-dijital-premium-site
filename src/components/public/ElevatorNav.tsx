"use client";

import { useEffect, useMemo, useState } from "react";

export type ElevatorFloor = {
  id: string;
  number: string;
  label: string;
};

export function ElevatorNav({ floors }: { floors: ElevatorFloor[] }) {
  const [active, setActive] = useState(floors[0]?.id || "");
  const [progress, setProgress] = useState(0);
  const activeIndex = useMemo(() => Math.max(0, floors.findIndex((floor) => floor.id === active)), [active, floors]);

  useEffect(() => {
    const sections = floors
      .map((floor) => document.getElementById(floor.id))
      .filter(Boolean) as HTMLElement[];
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -45% 0px", threshold: [0.18, 0.35, 0.55, 0.75] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [floors]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        setProgress(Math.min(1, Math.max(0, window.scrollY / max)));
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <nav aria-label="Sayfa bölümleri" className="elevator-nav fixed left-5 top-1/2 z-40 hidden -translate-y-1/2 xl:block">
        <div className="relative rounded-[18px] border border-cyan-200/15 bg-[#030712]/78 p-3 shadow-[0_18px_70px_rgba(0,0,0,.38)] backdrop-blur-2xl">
          <div className="absolute bottom-5 left-7 top-5 w-px overflow-hidden rounded-full bg-white/10">
            <div className="w-full rounded-full bg-gradient-to-b from-cyan-200 via-amber-200 to-orange-400 transition-[height] duration-300" style={{ height: `${progress * 100}%` }} />
          </div>
          <div className="grid gap-2">
            {floors.map((floor, index) => {
              const selected = floor.id === active;
              return (
                <button
                  key={floor.id}
                  type="button"
                  onClick={() => goTo(floor.id)}
                  className={`group relative grid min-w-[170px] grid-cols-[34px_1fr] items-center gap-3 rounded-[12px] px-2.5 py-2.5 text-left transition duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 ${selected ? "bg-cyan-300/14 text-white shadow-[0_0_34px_rgba(34,211,238,.18)]" : "text-slate-500 hover:bg-white/[0.055] hover:text-slate-100"}`}
                  aria-current={selected ? "true" : undefined}
                >
                  <span className={`relative z-10 grid size-8 place-items-center rounded-full border text-[11px] font-black transition ${selected ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-white/10 bg-[#07101c] text-slate-400 group-hover:border-cyan-200/40 group-hover:text-cyan-100"}`}>
                    {floor.number}
                  </span>
                  <span>
                    <span className="block text-[10px] font-black uppercase tracking-[.18em] text-cyan-100/70">Kat {index + 1}</span>
                    <span className="mt-0.5 block text-sm font-black">{floor.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="sticky top-[72px] z-30 mx-auto mb-3 flex w-fit max-w-[calc(100vw-24px)] items-center gap-2 rounded-full border border-cyan-200/15 bg-[#030712]/82 px-3 py-2 text-xs font-black text-cyan-100 shadow-[0_16px_52px_rgba(0,0,0,.28)] backdrop-blur-2xl xl:hidden">
        <span className="grid size-7 place-items-center rounded-full bg-cyan-300 text-slate-950">{floors[activeIndex]?.number || "01"}</span>
        <span>{floors[activeIndex]?.label || "Ana Sayfa"}</span>
      </div>
    </>
  );
}

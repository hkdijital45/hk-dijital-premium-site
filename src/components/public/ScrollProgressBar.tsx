"use client";

import { useEffect, useState } from "react";

/**
 * Thin fixed progress bar tracking overall page scroll position, matching
 * the reference design's #progress element. Pure CSS width update on scroll
 * (no per-frame animation loop), so prefers-reduced-motion users are
 * unaffected — this is a static-position indicator, not a moving animation.
 */
export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function update() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? (doc.scrollTop / max) * 100 : 0);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      role="progressbar"
      aria-label="Sayfa kaydırma ilerlemesi"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="pointer-events-none fixed left-0 top-0 z-[60] h-[3px] w-full bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-[#7c3aed] via-[#4fa8f0] to-[#ec4899]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

import type { ReactNode } from "react";

/**
 * A public-site-specific laptop visual, deliberately separate from the
 * shared `src/components/public/MacBookMockup.tsx` (which is also used by
 * `/digital-center` and `/musteri-paneli` — customer-facing surfaces this
 * component must never risk affecting). The shared mockup's base collapses
 * to a razor-thin hinge sliver with no visible keyboard deck, which reads
 * as a flat tablet rather than a laptop; this component gives the base real
 * visible geometry (keyboard texture + trackpad) and relies on true CSS 3D
 * perspective (not a compensating scaleY) so the base visibly recedes at
 * the hinge and extends toward the viewer at its front edge.
 *
 * Purely presentational — the animated transform (rotate/scale/opacity/
 * blur) is applied by the parent via a ref to the outermost element here,
 * exactly like the shared mockup's own pattern, so this component owns
 * only the static laptop geometry, not any motion.
 */
export function CinematicMacBook({ screen }: { screen: ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-lg" aria-hidden="true">
      {/* Lid: hinge at its bottom edge, tilts back slightly (small positive rotateX from a bottom origin). */}
      <div
        className="relative mx-auto"
        style={{
          width: "84%",
          aspectRatio: "16 / 10.2",
          transformOrigin: "bottom center",
          transform: "rotateX(7deg)",
          transformStyle: "preserve-3d",
          borderRadius: "9% / 7%",
          padding: "3.4% 3.4% 0",
          background: "linear-gradient(155deg, #3a3f4e 0%, #1a1d25 52%, #0a0b0f 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 1px rgba(255,255,255,.06), 0 26px 54px rgba(0,0,0,.42)"
        }}
      >
        <div
          aria-hidden="true"
          style={{ position: "absolute", top: "1.3%", left: "50%", width: 5, height: 5, transform: "translateX(-50%)", borderRadius: 999, background: "radial-gradient(circle, rgba(196,181,253,.6), rgba(0,0,0,.85))" }}
        />
        <div
          className="macbook-mockup-screen"
          style={{ position: "relative", height: "100%", overflow: "hidden", borderRadius: "3.5% / 4%", background: "linear-gradient(160deg, #0a0f17 0%, #030509 100%)", boxShadow: "inset 0 0 0 1px rgba(124,58,237,.16)" }}
        >
          {screen}
        </div>
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "9% / 7%", background: "linear-gradient(115deg, rgba(255,255,255,.09) 0%, transparent 20%, transparent 80%, rgba(255,255,255,.04) 100%)" }}
        />
      </div>

      {/* Hinge bar — a distinct visible seam between lid and base, not just a margin gap. Same width
          as the lid so the seam lines up instead of stepping. */}
      <div
        aria-hidden="true"
        className="relative mx-auto"
        style={{ width: "84%", height: "3px", borderRadius: 2, background: "linear-gradient(180deg, #34384380, #05060830)", boxShadow: "0 1px 0 rgba(255,255,255,.08)" }}
      />

      {/* Base / keyboard deck: large rotateX from a top origin (hinge edge) so the front edge — where
          the trackpad sits — genuinely extends toward the viewer via real perspective foreshortening,
          not a flattened scaleY compensation. `perspective` on the ancestor MacBookEcosystem wrapper is
          what makes this trapezoidal "receding" read correctly rather than looking like a flat squash. */}
      <div
        className="relative mx-auto"
        style={{
          width: "84%",
          aspectRatio: "16 / 6.4",
          transformOrigin: "top center",
          transform: "rotateX(60deg)",
          borderRadius: "0 0 9% 9%",
          background: "linear-gradient(178deg, #383d4c 0%, #1d2028 42%, #0e0f14 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.14), inset 0 -10px 18px -6px rgba(0,0,0,.45), 0 46px 46px -18px rgba(0,0,0,.5)"
        }}
      >
        {/* Keyboard texture — a grid of small keys, purely decorative, sells "keyboard" at a glance. */}
        <div className="grid grid-cols-12 gap-[3%] px-[9%] pt-[10%]" style={{ opacity: 0.5 }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} style={{ aspectRatio: "1 / .72", borderRadius: 2, background: "linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.02))" }} />
          ))}
        </div>
        {/* Trackpad */}
        <div style={{ width: "27%", height: "36%", margin: "5% auto 0", borderRadius: 7, background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.015))", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.09)" }} />
        {/* Front aluminum edge highlight, the closest-to-viewer edge of the base. */}
        <div
          aria-hidden="true"
          style={{ position: "absolute", left: "4%", right: "4%", bottom: "2%", height: "3px", borderRadius: 999, background: "linear-gradient(90deg, transparent, rgba(196,181,253,.55), transparent)" }}
        />
      </div>

      {/* Ambient contact shadow beneath the whole device. */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "6%", right: "6%", bottom: "-8%", height: "14%", borderRadius: 999, background: "radial-gradient(ellipse at center, rgba(0,0,0,.4), transparent 70%)", filter: "blur(9px)" }}
      />
    </div>
  );
}

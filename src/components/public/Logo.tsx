"use client";

import Image from "next/image";
import { useState } from "react";
import type { SiteContent } from "@/lib/types";

type LogoVariant = "website" | "login" | "customer" | "footer";

// The ORIGINAL full-composition mark (teal tech-ring + rising arrow, metallic
// "HK", "HK DİJİTAL" wordmark, orange underline — one lossless crop of fully
// transparent canvas margin only, no pixel redrawn/recolored/split) for the
// public navbar/footer — see public/branding/hk-dijital-logo-original.png for
// the untouched 1024x1024 source this was cropped from. Replaces the earlier
// horizontally-stretched lockup that spread the emblem and wordmark apart;
// the full composition is taller than it is wide, so it needs real navbar
// height (not a thin strip) to read clearly — see the `large` className
// below. Not CMS-configurable (unlike content.brand.logoUrl): this is a
// fixed site-chrome asset, same way the navbar itself isn't admin-editable.
const FULL_LOGO = "/branding/hk-dijital-logo-full.png";
// Intrinsic dimensions of the source PNG — keep in sync with the asset file
// so next/image serves correctly-sized 1x/2x candidates (no upscaling blur).
const FULL_LOGO_SIZE = { width: 666, height: 641 };

export function Logo({
  content,
  footer = false,
  compact = false,
  variant = "website",
  /** Public navbar only. */
  large = false
}: {
  content: SiteContent;
  footer?: boolean;
  compact?: boolean;
  variant?: LogoVariant;
  large?: boolean;
}) {
  const logoByVariant: Record<LogoVariant, string | undefined> = {
    website: content.brand.logoUrl,
    login: content.brand.loginLogoUrl || content.brand.logoUrl,
    customer: content.brand.customerLogoUrl || content.brand.logoUrl,
    footer: content.brand.footerLogoUrl || content.brand.logoUrl
  };
  const logo = large ? FULL_LOGO : logoByVariant[footer ? "footer" : variant];
  const [failedLogo, setFailedLogo] = useState("");
  const failed = Boolean(logo && failedLogo === logo);

  if (logo && !failed) {
    // PageSpeed flagged the square asset: an 886x886 ~308 KiB PNG shipped
    // unoptimized for a ~44-48px render. `unoptimized` bypassed next/image's
    // built-in resizing entirely. Only same-origin brand assets under
    // /branding/ are safe to let next/image optimize — next.config.ts has no
    // remotePatterns configured, so an arbitrary customer-uploaded external
    // logo URL would otherwise fail to render.
    const isRelative = logo.startsWith("/");
    const size = large ? FULL_LOGO_SIZE : { width: 64, height: 64 };
    return (
      <Image
        src={logo}
        alt={large ? "HK Dijital" : `${content.brand.companyName} logosu`}
        width={size.width}
        height={size.height}
        priority={large}
        onError={() => setFailedLogo(logo)}
        unoptimized={!isRelative}
        className={large ? "h-14 w-auto shrink-0 object-contain object-left sm:h-16" : "h-11 w-11 shrink-0 rounded-[10px] object-contain object-left sm:h-12 sm:w-12"}
      />
    );
  }

  return (
    <span className="inline-flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-sm font-black text-cyan-200 shadow-[0_0_28px_rgba(18,217,255,.28)]">
        HK
      </span>
      {!compact && <span className="text-lg font-black tracking-wide text-white">{content.brand.companyName}</span>}
    </span>
  );
}

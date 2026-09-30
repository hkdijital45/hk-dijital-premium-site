"use client";

import Image from "next/image";
import { useState } from "react";
import type { SiteContent } from "@/lib/types";

type LogoVariant = "website" | "login" | "customer" | "footer";

export function Logo({ content, footer = false, compact = false, variant = "website" }: { content: SiteContent; footer?: boolean; compact?: boolean; variant?: LogoVariant }) {
  const logoByVariant: Record<LogoVariant, string | undefined> = {
    website: content.brand.logoUrl,
    login: content.brand.loginLogoUrl || content.brand.logoUrl,
    customer: content.brand.customerLogoUrl || content.brand.logoUrl,
    footer: content.brand.footerLogoUrl || content.brand.logoUrl
  };
  const logo = logoByVariant[footer ? "footer" : variant];
  const [failedLogo, setFailedLogo] = useState("");
  const failed = Boolean(logo && failedLogo === logo);

  if (logo && !failed) {
    // PageSpeed flagged this exact asset: an 886x886 ~308 KiB PNG shipped
    // unoptimized for a ~44-48px render. `unoptimized` bypassed next/image's
    // built-in resizing entirely. Only the default, same-origin brand asset
    // (/branding/hk-dijital-logo.png) is safe to let next/image optimize —
    // next.config.ts has no remotePatterns configured, so an arbitrary
    // customer-uploaded external logo URL would otherwise fail to render.
    const isRelative = logo.startsWith("/");
    return <Image src={logo} alt={`${content.brand.companyName} logosu`} width={64} height={64} unoptimized={!isRelative} onError={() => setFailedLogo(logo)} className="h-11 w-11 shrink-0 rounded-[10px] object-contain object-left sm:h-12 sm:w-12" />;
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

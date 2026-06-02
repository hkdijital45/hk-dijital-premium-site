"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { SiteContent } from "@/lib/types";

export function Logo({ content, footer = false, compact = false }: { content: SiteContent; footer?: boolean; compact?: boolean }) {
  const logo = footer ? content.brand.footerLogoUrl || content.brand.logoUrl : content.brand.logoUrl;
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [logo]);

  if (logo && !failed) {
    return <Image src={logo} alt={`${content.brand.companyName} logosu`} width={180} height={52} unoptimized onError={() => setFailed(true)} className="h-10 max-w-[180px] object-contain object-left sm:h-11" />;
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

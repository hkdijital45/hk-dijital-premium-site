import Image from "next/image";
import type { SiteContent } from "@/lib/types";

export function Logo({ content, footer = false }: { content: SiteContent; footer?: boolean }) {
  const logo = footer ? content.brand.footerLogoUrl || content.brand.logoUrl : content.brand.logoUrl;

  if (logo) {
    return <Image src={logo} alt={`${content.brand.companyName} logosu`} width={148} height={42} className="h-10 w-auto" />;
  }

  return (
    <span className="inline-flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-sm font-black text-cyan-200 shadow-[0_0_28px_rgba(18,217,255,.28)]">
        HK
      </span>
      <span className="text-lg font-black tracking-wide text-white">{content.brand.companyName}</span>
    </span>
  );
}

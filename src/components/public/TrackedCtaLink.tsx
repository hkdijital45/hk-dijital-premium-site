"use client";

import type { ReactNode } from "react";
import { trackMetaCtaClick } from "@/lib/meta-pixel";
import { trackEvent } from "@/components/public/TrackingPlaceholders";

type Props = {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
  target?: string;
  rel?: string;
} & ({ kind: "cta"; label: string } | { kind: "social"; platform: string });

// Minimal client-component wrapper so a Server Component page (e.g.
// /iletisim) can render a real tracked CTA/social link without becoming a
// client component itself.
// - kind="cta": trackMetaCtaClick already mirrors to GA4
//   (whatsapp_click/select_content/etc. by href pattern) and Meta in one
//   call — see src/lib/meta-pixel.ts.
// - kind="social": trackEvent("social_link_clicked", {platform}) — same
//   dispatcher SocialLinks.tsx already uses, so this fires the identical
//   social_outbound_click GA4 event + HK_CTA_Click Meta event, never a
//   second, differently-shaped one.
export function TrackedCtaLink({ href, className, style, children, target, rel, ...tracking }: Props) {
  const onClick = () => {
    if (tracking.kind === "social") trackEvent("social_link_clicked", { platform: tracking.platform });
    else trackMetaCtaClick(tracking.label, href);
  };
  return (
    <a href={href} target={target} rel={rel} onClick={onClick} className={className} style={style}>
      {children}
    </a>
  );
}

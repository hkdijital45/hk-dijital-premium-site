"use client";

import type { PublicSiteContent } from "@/lib/types";
import { socialBrandIcons } from "./SocialBrandIcons";
import { isRealProfileUrl } from "@/lib/public-contact";
import { trackEvent } from "./TrackingPlaceholders";

// Full accessible names ("open our X account"-style), not just the bare
// platform name — read aloud on their own by a screen reader with no
// surrounding context, "Instagram" alone doesn't say what activating the
// link does.
const accessibleLabels: Record<string, string> = {
  instagram: "Instagram hesabımızı aç",
  facebook: "Facebook sayfamızı aç",
  youtube: "YouTube kanalımızı aç",
  twitter: "X hesabımızı aç",
  linkedin: "LinkedIn sayfamızı aç",
  whatsapp: "WhatsApp'tan yazın",
  tiktok: "TikTok hesabımızı aç"
};

export function SocialLinks({ content }: { content: PublicSiteContent }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {Object.entries(content.socials).map(([key, href]) => {
        // Matched by normalized platform key, not list position — and
        // "x"/"twitter" both resolve to the same X glyph regardless of
        // which spelling a given record happens to use.
        const normalizedKey = key.trim().toLowerCase();
        const Icon = socialBrandIcons[normalizedKey];
        if (!Icon || !href || !isRealProfileUrl(key, href)) return null;
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent("social_link_clicked", { platform: key })}
            className="grid size-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-[#8FE9E2]/40 hover:text-[#8FE9E2] focus:outline-none focus:ring-2 focus:ring-[#8FE9E2]/60"
            aria-label={accessibleLabels[normalizedKey] ?? key}
          >
            <Icon aria-hidden="true" className="size-[22px]" />
          </a>
        );
      })}
    </div>
  );
}

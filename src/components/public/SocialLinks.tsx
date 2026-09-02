"use client";

import type { SiteContent } from "@/lib/types";
import { socialIcons } from "@/lib/icons";
import { trackEvent } from "./TrackingPlaceholders";

const labels: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  twitter: "X / Twitter",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
  tiktok: "TikTok"
};

function isRealProfileUrl(key: string, href: string) {
  try {
    const url = new URL(href);
    const path = url.pathname.replace(/\/+$/, "");
    if (!path || path === "") return key === "whatsapp";
    return path !== "/" && !["/hk", "/profile"].includes(path.toLowerCase());
  } catch {
    return false;
  }
}

export function SocialLinks({ content }: { content: SiteContent }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {Object.entries(content.socials).map(([key, href]) => {
        const Icon = socialIcons[key];
        if (!Icon || !href || !isRealProfileUrl(key, href)) return null;
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent("social_link_clicked", { platform: key })}
            className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-[#a78bfa]/40 hover:text-[#c4b5fd]"
            aria-label={labels[key] ?? key}
            title={labels[key] ?? key}
          >
            <Icon size={17} />
          </a>
        );
      })}
    </div>
  );
}

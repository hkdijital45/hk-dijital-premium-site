import type { SVGProps } from "react";

/**
 * Small, simplified platform marks used purely as supporting visual
 * elements (floating chips, service-card tags, footer strip) — never as
 * dominant branding and never paired with "official partner/certified"
 * language, since no such partnership is confirmed in this repository.
 */

export function GoogleMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.14-3.13-.4-4.6H24v9h11.8c-.5 2.8-2.06 5.16-4.4 6.75v5.6h7.1c4.16-3.83 6.6-9.47 6.6-16.75Z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.32l-7.1-5.6c-1.97 1.32-4.5 2.1-7.46 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.78C7.96 41.07 15.4 46 24 46Z" />
      <path fill="#FBBC05" d="M11.69 27.11a13.44 13.44 0 0 1 0-8.22v-5.78H4.34a22 22 0 0 0 0 19.78l7.35-5.78Z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.3-6.3C34.9 3.99 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.11l7.35 5.78C13.42 14.62 18.27 10.75 24 10.75Z" />
    </svg>
  );
}

export function MetaMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M8 26.6C8 18 13.2 11 20 11c3.7 0 6.5 2.1 9 5.4 2.5-3.3 5.3-5.4 9-5.4 6.8 0 12 7 12 15.6 0 6.8-3.2 10.4-7 10.4-3 0-4.8-1.7-7.7-6.4l-3-4.9-1.9 3.1c-2.6 4.3-4.7 8.2-8.9 8.2-3.9 0-7-3.6-7-10.4Z" fill="url(#meta-grad)" />
      <defs>
        <linearGradient id="meta-grad" x1="8" y1="11" x2="40" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0064E1" />
          <stop offset=".5" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function InstagramMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#ig-grad)" />
      <rect x="13" y="13" width="22" height="22" rx="7" stroke="#fff" strokeWidth="2.6" />
      <circle cx="24" cy="24" r="6.2" stroke="#fff" strokeWidth="2.6" />
      <circle cx="33" cy="15" r="1.8" fill="#fff" />
      <defs>
        <linearGradient id="ig-grad" x1="4" y1="44" x2="44" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEC564" />
          <stop offset=".35" stopColor="#E1306C" />
          <stop offset=".7" stopColor="#C13584" />
          <stop offset="1" stopColor="#5851DB" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function FacebookMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="24" cy="24" r="20" fill="#1877F2" />
      <path d="M27.6 30.8h5l.8-5.4h-5.8v-3.5c0-1.6.5-2.9 3-2.9h2.1v-4.8c-1.1-.1-2.4-.2-3.9-.2-4.1 0-7 2.5-7 7.1v3.9H17v5.4h4.8V44h5.8V30.8Z" fill="#fff" />
    </svg>
  );
}

export function TikTokMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="48" height="48" rx="12" fill="#0A0A0A" />
      <path d="M31.5 12.5c1 2.6 3 4.5 6 4.9v4.6c-2.2.1-4.2-.5-6-1.7v10.1c0 5.3-4.3 9.3-9.4 9.3-5.2 0-9.4-4.2-9.4-9.4 0-5.1 4.1-9.3 9.2-9.4v4.8c-2.5.2-4.4 2.2-4.4 4.6 0 2.6 2.1 4.6 4.6 4.6s4.7-2 4.7-4.6V12.5h4.7Z" fill="#fff" />
      <path d="M31.5 12.5c.6 1.7 1.7 3.1 3.1 4V12.5h-3.1Z" fill="#25F4EE" opacity=".7" />
      <path d="M37.5 17.4v4.6c-2.2.1-4.2-.5-6-1.7v-3c1.8.9 3.8 1.4 6 1.4-.5 0-.5 0 0-1.3Z" fill="#FE2C55" opacity=".55" />
    </svg>
  );
}

export function YouTubeMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="3" y="10" width="42" height="28" rx="8" fill="#FF0000" />
      <path d="M20 17.5 31 24l-11 6.5v-13Z" fill="#fff" />
    </svg>
  );
}

export function LinkedInMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="48" height="48" rx="9" fill="#0A66C2" />
      <path d="M12.9 20h5.4v16h-5.4V20Zm2.7-8.6a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2Z" fill="#fff" />
      <path d="M21.6 20h5.2v2.2h.1c.7-1.3 2.5-2.7 5.2-2.7 5.6 0 6.6 3.6 6.6 8.4V36h-5.4v-7.1c0-1.7 0-3.9-2.4-3.9-2.4 0-2.8 1.9-2.8 3.8V36h-5.4V20Z" fill="#fff" />
    </svg>
  );
}

export const platformMarks = [
  { key: "google", label: "Google Ads", Icon: GoogleMark },
  { key: "meta", label: "Meta", Icon: MetaMark },
  { key: "instagram", label: "Instagram", Icon: InstagramMark },
  { key: "facebook", label: "Facebook", Icon: FacebookMark },
  { key: "tiktok", label: "TikTok", Icon: TikTokMark },
  { key: "youtube", label: "YouTube", Icon: YouTubeMark }
] as const;

export type PlatformKey = (typeof platformMarks)[number]["key"];

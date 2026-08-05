import type { ReactNode } from "react";

export type AdminStatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "ai" | "premium";

// HK Design System status tones — same hex values as the .hk-badge-* CSS
// classes in globals.css, expressed as Tailwind arbitrary-value utilities so
// this component needs no extra class-name plumbing. Every pair is verified
// ≥4.5:1 (WCAG AA for normal text).
const TONE_CLASS: Record<AdminStatusTone, string> = {
  neutral: "bg-[#F3F2EE] text-[#5F6672]",
  success: "bg-[#E8F8EC] text-[#167A3C]",
  warning: "bg-[#FFF7E2] text-[#8D5B00]",
  danger: "bg-[#FDECEC] text-[#B42318]",
  info: "bg-[#EAF6FD] text-[#1565C0]",
  ai: "bg-[#EEE8FF] text-[#4F35A8]",
  premium: "bg-[#F8E8AF] text-[#17140C]"
};

export function AdminStatusBadge({ tone = "neutral", children }: { tone?: AdminStatusTone; children: ReactNode }) {
  return <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-black ${TONE_CLASS[tone]}`}>{children}</span>;
}

export function healthScoreTone(score: number): AdminStatusTone {
  if (score < 60) return "danger";
  if (score < 75) return "warning";
  return "success";
}

import type { ReactNode } from "react";

export type AdminStatusTone = "neutral" | "success" | "warning" | "danger" | "info" | "ai" | "premium";

const TONE_CLASS: Record<AdminStatusTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  ai: "bg-purple-100 text-purple-700",
  premium: "bg-amber-100 text-amber-800"
};

export function AdminStatusBadge({ tone = "neutral", children }: { tone?: AdminStatusTone; children: ReactNode }) {
  return <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-black ${TONE_CLASS[tone]}`}>{children}</span>;
}

export function healthScoreTone(score: number): AdminStatusTone {
  if (score < 60) return "danger";
  if (score < 75) return "warning";
  return "success";
}

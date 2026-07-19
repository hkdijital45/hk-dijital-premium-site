import type { ReactNode } from "react";

export type AdminKpiTone = "primary" | "success" | "info" | "warning" | "danger" | "ai" | "communication";

export function AdminKpiCard({
  label,
  value,
  note,
  icon,
  tone = "primary",
  onClick
}: {
  label: string;
  value: ReactNode;
  note?: string;
  icon: ReactNode;
  tone?: AdminKpiTone;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag type={onClick ? "button" : undefined} onClick={onClick} className={`hk-kpi-card hk-kpi-${tone}`}>
      <span className="hk-kpi-icon">{icon}</span>
      <span className="mt-4 block text-sm font-black" style={{ color: "var(--admin-text-secondary)" }}>{label}</span>
      <strong className="mt-2 block break-words text-2xl" style={{ color: "var(--admin-text-primary)" }}>{value}</strong>
      {note && <span className="mt-1 block text-xs leading-5" style={{ color: "var(--admin-text-muted)" }}>{note}</span>}
    </Tag>
  );
}

export function AdminActionCard({
  title,
  description,
  icon,
  gradient,
  onClick
}: {
  title: string;
  description: string;
  icon: ReactNode;
  gradient: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="admin-card rounded-[20px] p-4 text-left transition hover:-translate-y-0.5">
      <span className={`grid size-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br ${gradient} text-white`}>{icon}</span>
      <p className="mt-3 text-sm font-black" style={{ color: "var(--admin-text-primary)" }}>{title}</p>
      <p className="mt-1 text-xs leading-5" style={{ color: "var(--admin-text-secondary)" }}>{description}</p>
    </button>
  );
}

import type { ReactNode } from "react";

export type AdminCompactKpiTone = "primary" | "success" | "info" | "warning" | "danger" | "ai";

export type AdminCompactKpiItem = {
  key: string;
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: AdminCompactKpiTone;
  onClick?: () => void;
};

/** Dense horizontal KPI strip for workspace headers — replaces oversized promo KPI cards. */
export function AdminCompactKpiStrip({ items }: { items: AdminCompactKpiItem[] }) {
  return (
    <div className="admin-kpi-strip">
      {items.map((item) => {
        const Tag = item.onClick ? "button" : "div";
        return (
          <Tag key={item.key} type={item.onClick ? "button" : undefined} onClick={item.onClick} className={`admin-kpi-strip-item admin-kpi-strip-${item.tone || "primary"}`}>
            <span className="admin-kpi-strip-icon">{item.icon}</span>
            <span className="admin-kpi-strip-text">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </span>
          </Tag>
        );
      })}
    </div>
  );
}

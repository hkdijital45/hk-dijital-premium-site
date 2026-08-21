// Canonical UI system decision (design-system duplication audit, real
// production adoption counts at the time of this decision):
//   page shell -> AdminWorkspace (the established shell every real
//     screen redesign since Sprint 1 has used)
//   button -> AdminButton (12 files import it vs. 2 for HKButton; the raw
//     `hk-button hk-button-{tone}` CSS classes both wrap are themselves the
//     single most common pattern in the app at 100+ literal usages, so
//     both components were already just two thin, drifting wrappers
//     around one design language — HKButton below now delegates to
//     AdminButton directly instead of keeping its own copy of the same
//     tone->class mapping)
//   status/badge -> AdminStatusBadge (11 files, WCAG-AA-verified hex
//     tokens) for the tones it covers; HKBadge stays available below for
//     the two tones it has that AdminStatusBadge doesn't (primary,
//     communication) rather than force those call sites onto a tone that
//     doesn't exist there
//   KPI -> AgencyStatCard (40+ call sites) for screen-level KPI strips;
//     HKKpiCard/the raw .hk-kpi-card pattern remain valid for existing
//     call sites that already use them (Customer 360 header) — not
//     migrated for migration's own sake
// This is a consolidation decision, not a mass-migration: existing call
// sites are not forced onto a different component, but new code should
// prefer the canonical ones above, and the component itself now avoids
// carrying its own duplicate copy of styling logic that already lives
// in the canonical implementation.
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { AdminButton, type AdminButtonVariant } from "@/components/admin/ui/AdminButton";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "ai" | "communication";
type Size = "sm" | "md" | "lg";
type ButtonToneKey = Tone | "secondary" | "outline" | "ghost";

// HKButton's own tone names map 1:1 onto AdminButton's (this file's
// "secondary"/"neutral" both mean AdminButton's "secondary"; "communication"
// and "ai" already exist on AdminButton verbatim) — delegating removes the
// second copy of this mapping rather than keeping it in sync by hand.
const variantToAdmin: Record<ButtonToneKey, AdminButtonVariant> = {
  primary: "primary",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  success: "success",
  warning: "warning",
  danger: "danger",
  info: "info",
  ai: "ai",
  communication: "communication",
  neutral: "secondary"
};

export function HKButton({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantToAdmin;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <AdminButton
      variant={variantToAdmin[variant]}
      compact={size === "sm"}
      loading={loading}
      icon={icon}
      className={`${size === "lg" ? "hk-button-lg" : ""} ${className}`}
      {...props}
    >
      {children}
    </AdminButton>
  );
}

export function HKIconButton({
  label,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type={type} aria-label={label} title={label} className={`hk-icon-button ${className}`} {...props}>
      {children}
    </button>
  );
}

export function HKCard({ children, className = "", variant = "default", ...props }: HTMLAttributes<HTMLDivElement> & { variant?: "default" | "elevated" | "interactive" | "selected" | "muted" | Tone }) {
  return <div className={`hk-card hk-card-${variant} ${className}`} {...props}>{children}</div>;
}

export function HKSectionCard({ title, description, action, children, className = "" }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`hk-section-card ${className}`}>
      <div className="hk-section-card-header">
        <div className="min-w-0">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function HKKpiCard({ label, value, note, icon, tone = "primary" }: { label: string; value: ReactNode; note?: string; icon?: ReactNode; tone?: Tone }) {
  return (
    <HKCard variant="interactive" className={`hk-kpi-card hk-kpi-${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black uppercase tracking-[.12em] text-[var(--admin-text-muted)]">{label}</p>
        {icon ? <span className="hk-kpi-icon">{icon}</span> : null}
      </div>
      <p className="mt-4 text-3xl font-black text-[var(--admin-text-primary)]">{value}</p>
      {note ? <p className="mt-2 text-sm font-semibold leading-6 text-[var(--admin-text-secondary)]">{note}</p> : null}
    </HKCard>
  );
}

export function HKBadge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`hk-badge hk-badge-${tone} ${className}`}>{children}</span>;
}

export function HKPageHeader({ eyebrow, title, description, action, className = "" }: { eyebrow?: string; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <header className={`hk-page-header ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <p className="hk-page-eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="hk-page-description">{description}</p> : null}
      </div>
      {action ? <div className="hk-page-actions">{action}</div> : null}
    </header>
  );
}

export function HKInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`hk-field ${props.className || ""}`} />;
}

export function HKTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`hk-field ${props.className || ""}`} />;
}

export function HKSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`hk-field ${props.className || ""}`} />;
}

export function HKSearchInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`hk-search-input ${className}`}>
      <Search size={17} aria-hidden="true" />
      <input {...props} />
    </label>
  );
}

export function HKEmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="hk-empty-state">
      {icon ? <div className="hk-empty-icon">{icon}</div> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Loader2, Search } from "lucide-react";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "ai" | "communication";
type Size = "sm" | "md" | "lg";

const buttonTone: Record<Tone | "secondary" | "outline" | "ghost", string> = {
  primary: "hk-button-primary",
  secondary: "hk-button-neutral",
  outline: "hk-button-outline",
  ghost: "hk-button-ghost",
  success: "hk-button-success",
  warning: "hk-button-warning",
  danger: "hk-button-danger",
  info: "hk-button-info",
  ai: "hk-button-ai",
  communication: "hk-button-communication",
  neutral: "hk-button-neutral"
};

const buttonSize: Record<Size, string> = {
  sm: "hk-button-compact",
  md: "",
  lg: "hk-button-lg"
};

export function HKButton({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonTone;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button type={type} disabled={disabled || loading} className={`hk-button ${buttonTone[variant]} ${buttonSize[size]} ${className}`} {...props}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
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
        <p className="text-sm font-black uppercase tracking-[.12em] text-slate-500">{label}</p>
        {icon ? <span className="hk-kpi-icon">{icon}</span> : null}
      </div>
      <p className="mt-4 text-3xl font-black text-slate-950">{value}</p>
      {note ? <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{note}</p> : null}
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

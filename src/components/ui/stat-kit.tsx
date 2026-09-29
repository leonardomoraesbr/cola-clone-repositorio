import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Standard page header used across Riot Vips pages */
export const PageHeader = ({
  icon: Icon,
  title,
  subtitle,
  action,
  gradient = "from-primary to-teal-500",
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  gradient?: string;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-4 mb-8 animate-fade-in">
    <div className="flex items-center gap-4">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br", gradient)}>
        <Icon className="w-6 h-6 text-primary-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

/** Big hero metric card */
export const HeroCard = ({ icon: Icon, label, value, footnote, color, valueClass }: any) => (
  <div className="glass-card p-6 hover:border-primary/40 transition-all duration-300">
    <div className="flex items-start justify-between gap-3 mb-6">
      <p className="text-muted-foreground text-[10px] uppercase tracking-[0.18em] font-medium">{label}</p>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <p className={cn("font-mono text-4xl font-bold tracking-tight", valueClass)}>{value}</p>
    {footnote && <p className="text-[10px] text-muted-foreground mt-4 uppercase tracking-[0.14em]">{footnote}</p>}
  </div>
);

/** Compact metric card with a progress/accent bar */
export const StatCard = ({ icon: Icon, label, value, subValue, color, bar, progress }: any) => (
  <div className="glass-card p-5 hover:border-primary/40 transition-all duration-300">
    <div className="flex items-center gap-2.5 mb-4">
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <p className="text-xs font-medium leading-tight">{label}</p>
    </div>
    <p className="font-mono text-2xl font-bold tracking-tight truncate" title={typeof value === "string" ? value : undefined}>{value}</p>
    <p className="text-[10px] text-muted-foreground uppercase tracking-[0.14em] mt-2">{subValue || "\u00A0"}</p>
    <div className="mt-4 h-1 rounded-full bg-secondary overflow-hidden">
      <div
        className={cn("h-full rounded-full opacity-70", bar || "bg-primary")}
        style={{ width: progress === undefined ? "100%" : `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  </div>
);

/** Panel with icon + title/subtitle header */
export const Panel = ({ icon: Icon, title, subtitle, action, children, className }: any) => (
  <div className={cn("glass-card p-5 animate-fade-in", className)}>
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-secondary/70 border border-border/50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em] mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </div>
);

export const SectionTitle = ({ children, hint }: any) => (
  <div className="mb-3">
    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">{children}</h3>
    {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
  </div>
);

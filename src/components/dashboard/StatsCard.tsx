import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "primary" | "accent";
}

export function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = "default" 
}: StatsCardProps) {
  return (
    <div className={cn(
      "glass-card-hover p-6 animate-fade-in",
      variant === "primary" && "border-primary/30",
      variant === "accent" && "border-accent/30"
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={cn(
            "stat-value",
            variant === "primary" && "text-primary",
            variant === "accent" && "text-accent"
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "flex items-center gap-1 text-sm",
              trend.isPositive ? "text-green-400" : "text-destructive"
            )}>
              <span>{trend.isPositive ? "↑" : "↓"}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground">vs ontem</span>
            </div>
          )}
        </div>
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center",
          variant === "default" && "bg-secondary",
          variant === "primary" && "bg-primary/20",
          variant === "accent" && "bg-accent/20"
        )}>
          <Icon className={cn(
            "w-6 h-6",
            variant === "default" && "text-muted-foreground",
            variant === "primary" && "text-primary",
            variant === "accent" && "text-accent"
          )} />
        </div>
      </div>
    </div>
  );
}

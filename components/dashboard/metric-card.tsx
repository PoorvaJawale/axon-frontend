import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: "default" | "success" | "danger" | "warning";
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
}: MetricCardProps) {
  const variantStyles = {
    default: "text-foreground",
    success: "text-emerald-400",
    danger: "text-red-400",
    warning: "text-yellow-400",
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all hover:border-border hover:bg-card/80">
      {/* Gradient glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className={`h-5 w-5 ${variantStyles[variant]}`} />
        </div>

        <p className={`mt-3 text-3xl font-bold ${variantStyles[variant]}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>

        {trend && (
          <p
            className={`mt-2 text-sm ${
              trend.isPositive ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {trend.isPositive ? "+" : "-"}
            {trend.value}% from last hour
          </p>
        )}
      </div>
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6">
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-5 w-5 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-3 h-9 w-20 animate-pulse rounded bg-muted" />
    </div>
  );
}

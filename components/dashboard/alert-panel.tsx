import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import type { Alert } from "@/app/api/alerts/route";

interface AlertPanelProps {
  alerts: Alert[];
}

export function AlertPanel({ alerts }: AlertPanelProps) {
  const latestAlert = alerts[0];

  if (!latestAlert) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-foreground">Latest Alert</h2>
        <p className="mt-4 text-muted-foreground">No blocked outputs to display.</p>
      </div>
    );
  }

  const severityConfig = {
    high: {
      icon: ShieldAlert,
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      textColor: "text-red-400",
      iconBg: "bg-red-500/20",
    },
    medium: {
      icon: AlertTriangle,
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
      textColor: "text-yellow-400",
      iconBg: "bg-yellow-500/20",
    },
    low: {
      icon: Info,
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
      textColor: "text-blue-400",
      iconBg: "bg-blue-500/20",
    },
  };

  const config = severityConfig[latestAlert.severity];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-6 backdrop-blur-sm`}
    >
      <div className="flex items-start gap-4">
        <div className={`rounded-lg ${config.iconBg} p-3`}>
          <Icon className={`h-6 w-6 ${config.textColor}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              {latestAlert.title}
            </h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${config.textColor} ${config.iconBg}`}
            >
              {latestAlert.severity}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {latestAlert.timestamp} - {latestAlert.actionType}
          </p>
          <p className="mt-3 text-sm text-foreground/80">
            {latestAlert.description}
          </p>

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Blocked Output
            </p>
            <pre className="overflow-x-auto rounded-lg bg-background/50 p-4 font-mono text-sm text-red-400">
              {latestAlert.blockedOutput}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertPanelSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-16 w-full animate-pulse rounded bg-muted" />
          <div className="mt-4 h-24 w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

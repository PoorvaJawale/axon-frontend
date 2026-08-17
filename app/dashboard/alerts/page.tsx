"use client";

import React, { useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Copy,
  Check,
  Eye,
  EyeOff,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AlertsPage() {
  const [filter, setFilter] = useState<"All" | "Unreviewed" | "Reviewed">("Unreviewed");

  const { data, isLoading, mutate } = useSWR(
    `/webhook/alerts?filter=${filter}`,
    fetcher,
    { refreshInterval: 15000, revalidateOnFocus: true }
  );

  const alerts = data?.alerts ?? [];

  const handleMarkAsReviewed = async (alertId: string, reviewedState: boolean) => {
    // Trigger optimistic update or just call API and re-mutate
    try {
      const response = await fetch("/webhook/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alertId, reviewed: reviewedState }),
      });

      if (response.ok) {
        // Refetch SWR query
        mutate();
      }
    } catch (err) {
      console.error("Failed to update alert status:", err);
    }
  };

  return (
    <div className="space-y-6 text-white">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Security Alerts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and audit AI output blocks triggered by security filters
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex rounded-lg bg-[#0a0d0c] p-1 border border-border/50 shrink-0">
          {(["All", "Unreviewed", "Reviewed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all ${
                filter === tab
                  ? "bg-[#37e39b]/15 text-[#37e39b] border border-[#37e39b]/20"
                  : "text-muted-foreground hover:text-white border border-transparent"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {isLoading ? (
          <AlertsListLoader />
        ) : alerts.length === 0 ? (
          <div className="rounded-xl border border-border/50 bg-[#0a0d0c]/30 py-16 text-center">
            <CheckCircle className="mx-auto h-10 w-10 text-primary mb-3" />
            <h3 className="text-sm font-semibold text-white">All Clear</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              No {filter !== "All" ? filter.toLowerCase() : ""} alerts found in the queue.
            </p>
          </div>
        ) : (
          alerts.map((alert: any) => {
            const isHigh = alert.severity === "HIGH";
            const isMedium = alert.severity === "MEDIUM";

            return (
              <div
                key={alert.id}
                className={`rounded-xl border p-6 space-y-4 transition-all duration-300 ${
                  alert.reviewed
                    ? "border-border bg-card/30 opacity-75 hover:opacity-100"
                    : isHigh
                    ? "border-red-500/20 bg-red-500/5 hover:border-red-500/40"
                    : isMedium
                    ? "border-yellow-500/20 bg-yellow-500/5 hover:border-yellow-500/40"
                    : "border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40"
                }`}
              >
                {/* Top Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.2 text-[9px] font-bold tracking-wider ${
                          isHigh
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : isMedium
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                            : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                        }`}
                      >
                        {alert.severity} SEVERITY
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {alert.timestamp}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white leading-snug">{alert.title}</h3>
                  </div>

                  {/* Mark as Reviewed Button */}
                  <button
                    onClick={() => handleMarkAsReviewed(alert.id, !alert.reviewed)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.8 text-xs font-semibold transition-all ${
                      alert.reviewed
                        ? "border-border bg-secondary hover:bg-muted text-muted-foreground hover:text-white"
                        : "border-[#37e39b]/25 bg-[#37e39b]/10 text-primary hover:bg-[#37e39b]/20"
                    }`}
                  >
                    {alert.reviewed ? (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        Mark Unreviewed
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Mark as Reviewed
                      </>
                    )}
                  </button>
                </div>

                {/* Description and Agent Details */}
                <div className="grid gap-2 text-xs">
                  <p className="text-muted-foreground leading-relaxed">{alert.description}</p>
                  <div className="flex flex-wrap gap-4 text-muted-foreground">
                    <div>
                      Agent ID: <code className="text-foreground font-mono">{alert.agentId}</code>
                    </div>
                    <div>
                      Action Type:{" "}
                      <code className="text-foreground capitalize">{alert.actionType}</code>
                    </div>
                  </div>
                </div>

                {/* Blocked Output Code Block */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Blocked Output Snippet
                  </span>
                  <AlertCodeBlock code={alert.blockedOutput} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Blocked Alert Code Block
function AlertCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-[#080b0a] shadow-inner relative group">
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-2 bg-muted/5">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-red-500/80" />
          <div className="h-2 w-2 rounded-full bg-yellow-500/80" />
          <div className="h-2 w-2 rounded-full bg-green-500/80" />
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded border border-border/50 bg-secondary/50 px-2 py-0.5 text-xs text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-primary" />
              <span className="text-primary">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-red-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Loader Skeleton
function AlertsListLoader() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/50 bg-[#0a0d0c]/30 p-6 space-y-4 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 rounded bg-muted/20" />
            <div className="h-8 w-28 rounded bg-muted/20" />
          </div>
          <div className="h-6 w-3/4 rounded bg-muted/20" />
          <div className="h-4 w-1/2 rounded bg-muted/20" />
          <div className="h-16 w-full rounded bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

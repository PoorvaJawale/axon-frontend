"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useAuth } from "@/app/context/AuthContext";
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { MetricCard, MetricCardSkeleton } from "@/components/dashboard/metric-card";

const fetcher = (url: string, token: string | null) =>
  fetch(url, {
    headers: {
      Authorization: `Bearer ${token || ""}`,
    },
  }).then((res) => res.json());

export default function DashboardPage() {
  const { userApiKey, userPlan } = useAuth();
  const router = useRouter();
  
  // SWR fetches pointing to new webhook mock endpoints
  const { data: logsData, error: logsError, isLoading: logsLoading } = useSWR(
    userApiKey ? [`/webhook/logs?plan=${userPlan}`, userApiKey] : null,
    ([url, token]) => fetcher(url, token)
  );

  const { data: alertsData, error: alertsError, isLoading: alertsLoading } = useSWR(
    userApiKey ? ["/webhook/alerts", userApiKey] : null,
    ([url, token]) => fetcher(url, token)
  );

  const logs = logsData?.logs ?? [];
  const stats = logsData?.stats ?? { total: 0, passed: 0, blocked: 0, asyncFlags: 0 };
  const alerts = alertsData?.alerts ?? [];

  // Filter alerts for the latest unreviewed BLOCK or most recent HIGH/MEDIUM/LOW alert
  const latestAlert = alerts.length > 0 ? alerts[0] : null;

  return (
    <div className="space-y-6 text-white">
      {/* Back to Home Page Button */}
      <button
        onClick={() => router.push("/")}
        className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-[#111111]/30 hover:bg-[#111111]/60 px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-white transition-all cursor-pointer mb-2"
      >
        ← Back to Home Page
      </button>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor your AI validation pipeline in real-time
          </p>
        </div>
        <div className="text-xs text-muted-foreground font-mono bg-[#111111] border border-border px-3 py-1.5 rounded-lg select-all">
          API Key: {userApiKey ? `${userApiKey.substring(0, 14)}••••••••` : "Not Generated"}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {logsLoading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Total Validations"
              value={stats.total}
              icon={Activity}
              trend={{ value: 12, isPositive: true }}
            />
            <MetricCard
              title="Passed"
              value={stats.passed}
              icon={CheckCircle}
              variant="success"
              trend={{ value: 8, isPositive: true }}
            />
            <MetricCard
              title="Blocked"
              value={stats.blocked}
              icon={XCircle}
              variant="danger"
              trend={{ value: 3, isPositive: false }}
            />
            <MetricCard
              title="Async Flags"
              value={stats.asyncFlags}
              icon={Clock}
              variant="warning"
              trend={{ value: 5, isPositive: true }}
            />
          </>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Recent Logs Table */}
        <div className="lg:col-span-2 overflow-hidden rounded-xl border border-border/50 bg-[#111111]/30 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Logs</h2>
            <Link
              href="/dashboard/logs"
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              View all logs
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            {logsLoading ? (
              <LogsLoader />
            ) : logs.length === 0 ? (
              <EmptyState message="No logs received yet." />
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/5">
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Time
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Action Type
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Result
                    </th>
                    <th className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {logs.slice(0, 10).map((log: any) => (
                    <tr
                      key={log.id}
                      className="transition-colors hover:bg-muted/10 cursor-pointer"
                      onClick={() => window.location.href = "/dashboard/logs"}
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-xs font-mono text-muted-foreground">
                        {log.time}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground capitalize">
                        {log.actionType}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <ResultBadge result={log.result} />
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground truncate max-w-[200px]" title={log.reason}>
                        {log.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Latest Alert Panel */}
        <div className="lg:col-span-1">
          {alertsLoading ? (
            <AlertCardSkeleton />
          ) : !latestAlert ? (
            <div className="rounded-xl border border-border/50 bg-[#111111]/30 p-6 flex flex-col items-center justify-center h-full text-center">
              <CheckCircle className="h-8 w-8 text-primary mb-3" />
              <h3 className="text-sm font-semibold text-white">System Secure</h3>
              <p className="mt-1 text-xs text-muted-foreground">No recent blocks detected.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-red-400 font-semibold text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Latest Blocked Output
                </div>
                <SeverityBadge severity={latestAlert.severity} />
              </div>

              <div>
                <h3 className="text-base font-bold text-white leading-tight">
                  {latestAlert.title}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Agent ID: <code className="text-foreground font-mono">{latestAlert.agentId}</code>
                </p>
                <p className="mt-2 text-xs text-red-200/80 leading-relaxed">
                  {latestAlert.description}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>BLOCKED CONTENT</span>
                  <span>{latestAlert.timestamp}</span>
                </div>
                <LocalCodeBlock code={latestAlert.blockedOutput} />
              </div>

              <Link
                href="/dashboard/alerts"
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-red-950/40 hover:bg-red-950/60 border border-red-500/20 py-2 text-xs font-semibold text-red-200 transition-colors"
              >
                Go to Alerts Panel
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Result badge renderer
function ResultBadge({ result }: { result: "PASS" | "BLOCK" | "ASYNC FLAG" }) {
  const styles = {
    PASS: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    BLOCK: "bg-red-500/10 text-red-400 border-red-500/20",
    "ASYNC FLAG": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[result]}`}
    >
      {result}
    </span>
  );
}

// Severity badge renderer
function SeverityBadge({ severity }: { severity: "HIGH" | "MEDIUM" | "LOW" }) {
  const styles = {
    HIGH: "bg-red-500/20 text-red-400 border-red-500/30",
    MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    LOW: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.2 text-[10px] font-bold tracking-wider ${styles[severity]}`}
    >
      {severity}
    </span>
  );
}

// Local light code block
function LocalCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/80 bg-[#0a0a0a] font-mono text-[11px] leading-relaxed">
      <div className="absolute right-2 top-2 z-20">
        <button
          onClick={handleCopy}
          className="rounded p-1 bg-muted/40 hover:bg-muted text-muted-foreground hover:text-white transition-colors"
        >
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="p-3 pr-8 text-red-300 overflow-x-auto whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Skeletons and Loaders
function LogsLoader() {
  return (
    <div className="p-6 space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-4 w-24 rounded bg-muted/20" />
          <div className="h-4 w-28 rounded bg-muted/20" />
          <div className="h-4 w-16 rounded bg-muted/20" />
          <div className="h-4 flex-1 rounded bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

function AlertCardSkeleton() {
  return (
    <div className="rounded-xl border border-border/50 bg-[#111111]/30 p-6 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-muted/20" />
        <div className="h-4 w-12 rounded bg-muted/20" />
      </div>
      <div className="h-6 w-48 rounded bg-muted/20" />
      <div className="h-16 w-full rounded bg-muted/20" />
      <div className="h-12 w-full rounded bg-muted/20" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

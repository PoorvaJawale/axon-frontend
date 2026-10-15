"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Activity, ArrowUpRight, Check, CircleX, Flag, Shield } from "lucide-react";
import { dashboardFetcher } from "@/lib/dashboard";
import { DataState, DocsLink, PageHeader, RefreshButton, Status, useCompactRows } from "@/components/dashboard/ui";

type Log = { id: string; time: string; actionType: string; result: "PASS" | "BLOCK" | "ASYNC FLAG"; reason: string };
type Alert = { id: string; severity: string; title: string; description: string; agentId: string; timestamp: string };

export default function DashboardPage() {
  const compact = useCompactRows();
  const [mobileView, setMobileView] = useState("activity");
  const visibleCount = compact ? 2 : 8;
  const logsQuery = useSWR("/webhook/logs", dashboardFetcher, { refreshInterval: 10000 });
  const alertsQuery = useSWR("/webhook/alerts", dashboardFetcher, { refreshInterval: 10000 });
  const logs: Log[] = logsQuery.data?.logs ?? [];
  const stats = logsQuery.data?.stats ?? { total: 0, passed: 0, blocked: 0, asyncFlags: 0 };
  const alerts: Alert[] = alertsQuery.data?.alerts ?? [];
  const latest = alerts[0];
  const ready = !!logsQuery.data && !logsQuery.error;
  const rate = stats.total ? Math.round(stats.passed / stats.total * 100) : 0;
  return <div className="dash-page dash-fit-page dash-overview-page" data-view={mobileView}>
    <PageHeader title="Overview" description="A clear view of your agents. Every validation decision from the last 24 hours.">
      <Status tone={logsQuery.error ? "amber" : "neutral"}>{logsQuery.error ? "Connection interrupted" : "Updates every 10s"}</Status>
      <RefreshButton busy={logsQuery.isValidating || alertsQuery.isValidating} onClick={() => { void logsQuery.mutate(); void alertsQuery.mutate(); }} />
    </PageHeader>
    <section className="dash-stat-strip" aria-label="Validation summary">
      {[
        { label: "Total validations", value: stats.total, icon: Activity, tone: "", note: "Last 24 hours" },
        { label: "Passed", value: stats.passed, icon: Check, tone: "dash-green", note: stats.total ? `${rate}% of validations` : "No validations yet" },
        { label: "Blocked", value: stats.blocked, icon: CircleX, tone: "dash-red", note: "Prevented from executing" },
        { label: "Async flags", value: stats.asyncFlags, icon: Flag, tone: "dash-amber", note: "Flagged for review" },
      ].map(({ label, value, icon: Icon, tone, note }) => <div className="dash-stat" key={label}><div className="dash-stat-label"><Icon size={14} className={tone} />{label}</div><span className={`dash-stat-value ${tone}`} title={ready ? value.toLocaleString() : undefined} aria-label={ready ? value.toLocaleString() : "Unavailable"}>{ready ? new Intl.NumberFormat("en-US", { notation: value >= 1000000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value) : "—"}</span><span className="dash-stat-note">{note}</span></div>)}
    </section>
    <div className="dash-overview-tabs dash-segments" role="group" aria-label="Overview view">{[["activity", "Activity"], ["review", "Review queue"], ["breakdown", "Breakdown"]].map(([value, label]) => <button key={value} aria-pressed={mobileView === value} onClick={() => setMobileView(value)}>{label}</button>)}</div>
    <div className="dash-overview-grid">
      <section className="dash-panel">
        <div className="dash-panel-heading"><div><h2>Recent decisions</h2><p>The latest validation results across your agents.</p></div><Link className="dash-text-link" href="/dashboard/logs">All logs<ArrowUpRight size={14} /></Link></div>
        {logsQuery.isLoading || logsQuery.error || !logs.length ? <DataState loading={logsQuery.isLoading} error={logsQuery.error} retry={() => void logsQuery.mutate()} title="Your first decision starts here" description="Connect an agent to see what passes, what gets blocked, and why."><DocsLink /></DataState> : <div className="dash-table-scroll"><table className="dash-table"><thead><tr><th>Time</th><th>Action</th><th>Decision</th><th>Reason</th></tr></thead><tbody>{logs.slice(0, visibleCount).map(log => <tr key={log.id}><td className="dash-time dash-mono" title={log.time}>{log.time ? log.time.slice(-8) : "—"}</td><td>{log.actionType.replaceAll("_", " ")}</td><td><Status tone={log.result === "PASS" ? "green" : log.result === "BLOCK" ? "red" : "amber"}>{log.result === "ASYNC FLAG" ? "FLAG" : log.result}</Status></td><td className="dash-reason"><span className="dash-cell-reason" title={log.reason}>{log.reason}</span></td></tr>)}</tbody></table></div>}
        <div className="dash-pagination"><span>Latest {Math.min(logs.length, visibleCount)} decisions</span><span>24-hour window</span></div>
      </section>
      <aside className="dash-stack">
        <section className="dash-panel"><div className="dash-panel-heading"><h2>Review queue</h2><Shield size={16} className="dash-muted" /></div>
          {alertsQuery.isLoading || alertsQuery.error ? <DataState loading={alertsQuery.isLoading} error={alertsQuery.error} retry={() => void alertsQuery.mutate()} title="" /> : latest ? <div className="dash-summary"><Status tone={latest.severity === "HIGH" ? "red" : latest.severity === "MEDIUM" ? "amber" : "purple"}>{latest.severity} severity</Status><h3>{latest.title}</h3><p>{latest.description}</p><p className="dash-mono dash-small">{latest.agentId}</p><Link className="dash-text-link" href="/dashboard/alerts">Review alerts<ArrowUpRight size={14} /></Link></div> : <DataState title="No recent alerts" description="New alerts will appear here when an action needs your attention." />}
        </section>
        <section className="dash-panel"><div className="dash-panel-heading"><h2>Decision breakdown</h2></div><div className="dash-traffic"><div className="dash-traffic-legend"><span>Total</span><strong className="dash-mono">{ready ? stats.total.toLocaleString() : "—"}</strong></div><div className="dash-traffic-track" role="img" aria-label={ready ? `${stats.passed} passed, ${stats.blocked} blocked, ${stats.asyncFlags} flagged` : "Decision breakdown unavailable"}>{[{ value: stats.passed, color: "var(--primary)" }, { value: stats.blocked, color: "var(--ax-red)" }, { value: stats.asyncFlags, color: "var(--ax-amber)" }].map(({ value, color }) => <span key={color} style={{ flex: stats.total ? `${value} 0 0%` : "0", background: color }} />)}</div><dl className="dash-definition"><div><dt>Passed</dt><dd className="dash-green dash-mono">{ready ? stats.passed.toLocaleString() : "—"}</dd></div><div><dt>Blocked</dt><dd className="dash-red dash-mono">{ready ? stats.blocked.toLocaleString() : "—"}</dd></div><div><dt>Flagged</dt><dd className="dash-amber dash-mono">{ready ? stats.asyncFlags.toLocaleString() : "—"}</dd></div></dl></div></section>
      </aside>
    </div>
  </div>;
}

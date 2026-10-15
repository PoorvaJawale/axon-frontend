"use client";
import { useState } from "react";
import useSWR from "swr";
import { Check, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { dashboardFetcher } from "@/lib/dashboard";
import { CopyButton, DataState, PageHeader, RefreshButton, Status, useCompactRows, usePageNumber } from "@/components/dashboard/ui";

type Alert = { id: string; severity: "HIGH" | "MEDIUM" | "LOW"; title: string; agentId: string; actionType: string; description: string; blockedOutput: string; timestamp: string; reviewed?: boolean };

export default function AlertsPage() {
  const pageSize = useCompactRows() ? 2 : 5;
  const [page, setPage] = usePageNumber(pageSize);
  const [filter, setFilter] = useState("Unreviewed");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const query = useSWR(`/webhook/alerts?filter=${filter}`, dashboardFetcher, { refreshInterval: 15000 });
  const alerts: Alert[] = query.data?.alerts ?? [];
  const tone = (severity: string) => severity === "HIGH" ? "red" as const : severity === "MEDIUM" ? "amber" as const : "purple" as const;
  const review = async (alert: Alert) => {
    if (pending) return;
    setPending(alert.id); setActionError("");
    try {
      const response = await fetch("/webhook/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alertId: alert.id, reviewed: !alert.reviewed }) });
      if (!response.ok) throw new Error("Update failed");
      const refreshed = await query.mutate();
      const saved = refreshed?.alerts?.find((item: Alert) => item.id === alert.id);
      if (saved && saved.reviewed === alert.reviewed) setActionError("Review tracking is not connected yet. This alert remains unreviewed; the original block is unchanged.");
    } catch { setActionError("Couldn't update this alert. Try again; its review status hasn't been confirmed."); }
    finally { setPending(null); }
  };
  return <div className="dash-page dash-fit-page dash-alerts-page">
    <PageHeader title="Security alerts" description="Investigate blocked actions and keep your review queue moving."><RefreshButton busy={query.isValidating} onClick={() => void query.mutate()} /></PageHeader>
    <div className="dash-section-heading" style={{ flexWrap: "wrap" }}>
      <div className="dash-segments" role="group" aria-label="Filter alerts">{["Unreviewed", "Reviewed", "All"].map(tab => <button key={tab} aria-pressed={filter === tab} onClick={() => { setFilter(tab); setPage(1); setExpanded(null); setActionError(""); }}>{tab === "All" ? "All alerts" : tab}</button>)}</div>
      <div className="dash-alert-counts" aria-label="Severity counts in current view">{["HIGH", "MEDIUM", "LOW"].map(severity => <span key={severity}><strong className={`dash-${tone(severity)}`}>{query.data && !query.error ? alerts.filter(a => a.severity === severity).length : "—"}</strong>{severity === "HIGH" ? "High" : severity === "MEDIUM" ? "Medium" : "Low"}</span>)}</div>
    </div>
    {actionError && <div role="alert" className="dash-notice">{actionError}<button className="dash-button dash-button-quiet" onClick={() => setActionError("")}>Dismiss</button></div>}
    <section className="dash-panel" aria-label="Alert queue">
      <div className="dash-panel-heading"><div><h2>{filter === "Unreviewed" ? "Needs review" : filter === "Reviewed" ? "Reviewed alerts" : "All alerts"}</h2></div><span className="dash-muted dash-mono dash-small">{query.data && !query.error ? alerts.length : "—"} in view</span></div>
      <div className="dash-alert-list" tabIndex={0} role="region" aria-label="Alerts in current page">
      {query.isLoading || query.error || !alerts.length ? <DataState loading={query.isLoading} error={query.error} retry={() => void query.mutate()} title={filter === "Unreviewed" ? "You're all caught up" : "No alerts in this view"} description={filter === "Unreviewed" ? "There are no unreviewed alerts. New blocked actions will appear here." : "Choose another view to check the rest of your queue."} /> : alerts.slice((Math.min(page, Math.max(1, Math.ceil(alerts.length / pageSize))) - 1) * pageSize, Math.min(page, Math.max(1, Math.ceil(alerts.length / pageSize))) * pageSize).map((alert) => {
        const isOpen = expanded === alert.id;
        return <article className="dash-alert-item" key={alert.id}><div className="dash-alert-summary"><Status tone={tone(alert.severity)}>{alert.severity}</Status><div><button className="dash-detail-toggle" onClick={() => setExpanded(isOpen ? "" : alert.id)} aria-expanded={isOpen} aria-controls={`alert-${alert.id}`}><ChevronRight size={16} /><span><span className="dash-alert-title">{alert.title}</span><span className="dash-alert-meta"><span className="dash-mono">{alert.agentId}</span> · {alert.actionType.replaceAll("_", " ")} · {alert.timestamp}</span></span></button></div><button className="dash-button dash-button-quiet" aria-label={pending === alert.id ? "Updating alert" : alert.reviewed ? "Mark unreviewed" : "Mark reviewed"} title={alert.reviewed ? "Mark unreviewed" : "Mark reviewed"} disabled={!!pending} onClick={() => void review(alert)}>{alert.reviewed ? <RotateCcw size={14} /> : <Check size={14} />}<span className="dash-review-label">{pending === alert.id ? "Updating…" : alert.reviewed ? "Mark unreviewed" : "Mark reviewed"}</span></button></div>
          {isOpen && <div className="dash-alert-detail" id={`alert-${alert.id}`}><div><p>{alert.description}</p><div className="dash-section-heading"><h2 className="dash-detail-label">Blocked output</h2><CopyButton text={alert.blockedOutput} /></div><pre className="dash-code" style={{ marginTop: 12, color: "#ffaaa4" }}>{alert.blockedOutput || "No output recorded."}</pre></div><dl className="dash-definition"><div><dt>Severity</dt><dd className={`dash-${tone(alert.severity)}`}>{alert.severity}</dd></div><div><dt>Action</dt><dd>{alert.actionType.replaceAll("_", " ")}</dd></div><div><dt>Decision</dt><dd className="dash-red">Blocked</dd></div><div><dt>Review status</dt><dd>{alert.reviewed ? "Reviewed" : "Unreviewed"}</dd></div></dl></div>}
        </article>;
      })}
      </div>
      <div className="dash-pagination"><span>{query.data && !query.error ? alerts.length : "—"} alerts</span><div className="dash-actions"><button className="dash-icon-button" aria-label="Previous alerts" disabled={page <= 1} onClick={() => { setPage(p => Math.max(1, p - 1)); setExpanded(null); }}><ChevronLeft size={15} /></button><span>Page {Math.min(page, Math.max(1, Math.ceil(alerts.length / pageSize)))} of {Math.max(1, Math.ceil(alerts.length / pageSize))}</span><button className="dash-icon-button" aria-label="Next alerts" disabled={page >= Math.ceil(alerts.length / pageSize)} onClick={() => { setPage(p => p + 1); setExpanded(null); }}><ChevronRight size={15} /></button></div></div>
    </section>
    <p className="dash-muted dash-small" style={{ margin: 0 }}>Review updates are not available yet. Alerts remain unreviewed until review tracking is enabled.</p>
  </div>;
}

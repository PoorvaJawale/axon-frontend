"use client";
import { Fragment, useEffect, useState } from "react";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { dashboardFetcher } from "@/lib/dashboard";
import { CopyButton, DataState, PageHeader, RefreshButton, Status, useCompactRows, usePageNumber } from "@/components/dashboard/ui";

export type WebhookLogEntry = { id: string; time: string; agentId: string; actionType: "email" | "database" | "payment" | "chat" | "api_call"; layerTriggered: string; result: "PASS" | "BLOCK" | "ASYNC FLAG"; reason: string; outputContent: string };

export default function LogsPage() {
  const pageSize = useCompactRows() ? 2 : 6;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [currentPage, setCurrentPage] = usePageNumber(pageSize);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search), 300); return () => clearTimeout(timer); }, [search]);
  const params = new URLSearchParams({ page: String(currentPage), limit: String(pageSize), result: resultFilter, actionType: actionFilter, search: debouncedSearch });
  const query = useSWR(`/webhook/logs?${params}`, dashboardFetcher, { refreshInterval: 10000 });
  const logs: WebhookLogEntry[] = query.data?.logs ?? [];
  const pagination = query.data?.pagination ?? { totalPages: 1, totalCount: 0 };
  const pages = Math.max(1, pagination.totalPages);
  const filtered = !!search || resultFilter !== "All" || actionFilter !== "All";
  const reset = () => { setSearch(""); setDebouncedSearch(""); setActionFilter("All"); setResultFilter("All"); setCurrentPage(1); setExpandedLogId(null); };
  return <div className="dash-page dash-fit-page dash-logs-page">
    <PageHeader title="Validation logs" description="Follow every decision back to the agent, the output, and the rule behind it."><RefreshButton busy={query.isValidating} onClick={() => void query.mutate()} /></PageHeader>
    <div className="dash-toolbar" aria-label="Filter validation logs">
      <div className="dash-search"><Search size={16} /><input aria-label="Search logs" placeholder="Search agents, reasons, or output…" value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); setExpandedLogId(null); }} />{search && <button className="dash-detail-toggle" onClick={() => { setSearch(""); setCurrentPage(1); }} aria-label="Clear search"><X size={16} /></button>}</div>
      <div className="dash-segments" role="group" aria-label="Filter by decision">{["All", "PASS", "BLOCK", "ASYNC FLAG"].map(value => <button key={value} aria-pressed={resultFilter === value} onClick={() => { setResultFilter(value); setCurrentPage(1); setExpandedLogId(null); }}>{value === "All" ? "All decisions" : value === "ASYNC FLAG" ? "Flag" : value === "PASS" ? "Pass" : "Block"}</button>)}</div>
      <select className="dash-select" aria-label="Filter by action" value={actionFilter} onChange={e => { setActionFilter(e.target.value); setCurrentPage(1); setExpandedLogId(null); }}><option value="All">All actions</option>{["email", "database", "payment", "chat", "api_call"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
      {filtered && <button className="dash-button dash-button-quiet" onClick={reset}>Reset filters</button>}
    </div>
    <section className="dash-panel" aria-label="Validation results" aria-busy={query.isLoading}>
      <div className="dash-panel-heading"><h2>Decision history</h2><span className="dash-muted dash-small dash-mono">{query.data ? `${pagination.totalCount.toLocaleString()} entries` : "— entries"}</span></div>
      {query.isLoading || query.error || !logs.length ? <DataState loading={query.isLoading} error={query.error} retry={() => void query.mutate()} title={filtered ? "No matching decisions" : "No validations yet"} description={filtered ? "Try a different search or clear your filters to see more decisions." : "Validation requests will appear here once your agent is connected."}>{filtered && <button className="dash-button" onClick={reset}>Clear filters</button>}</DataState> : <div className="dash-table-scroll" tabIndex={0} role="region" aria-label="Scrollable validation decisions"><table className="dash-table"><thead><tr><th>Agent / time</th><th>Decision</th><th>Action</th><th>Layer</th><th>Reason</th></tr></thead><tbody>{logs.map(log => {
        const expanded = expandedLogId === log.id;
        return <Fragment key={log.id}><tr><td><button className="dash-detail-toggle" aria-expanded={expanded} aria-controls={`log-${log.id}`} onClick={() => setExpandedLogId(expanded ? null : log.id)}><ChevronRight size={15} /><span><span className="dash-truncate dash-mono" title={log.agentId}>{log.agentId}</span><span className="dash-time dash-mono">{log.time || "—"}</span></span></button></td><td><Status tone={log.result === "PASS" ? "green" : log.result === "BLOCK" ? "red" : "amber"}>{log.result === "ASYNC FLAG" ? "FLAG" : log.result}</Status></td><td>{log.actionType.replaceAll("_", " ")}</td><td className="dash-muted dash-mono dash-small">{log.layerTriggered}</td><td className="dash-reason">{log.reason}</td></tr>
          {expanded && <tr className="dash-detail-row" id={`log-${log.id}`}><td colSpan={5}><div className="dash-detail"><div><div className="dash-section-heading"><h3 className="dash-detail-label">Raw agent output</h3><CopyButton text={log.outputContent} /></div><pre className="dash-code">{log.outputContent || "No output recorded."}</pre></div><div><h3 className="dash-detail-label">Decision details</h3><dl className="dash-definition"><div><dt>Layer</dt><dd>{log.layerTriggered}</dd></div><div><dt>Result</dt><dd>{log.result}</dd></div></dl><p className="dash-muted dash-small" style={{ marginTop: 20, overflowWrap: "anywhere" }}>{log.reason}</p></div></div></td></tr>}
        </Fragment>;
      })}</tbody></table></div>}
      <div className="dash-pagination"><span aria-live="polite">{query.data && !query.error ? `${logs.length ? (currentPage - 1) * pageSize + 1 : 0}–${logs.length ? (currentPage - 1) * pageSize + logs.length : 0} of ${pagination.totalCount.toLocaleString()}` : "Results unavailable"}</span><div className="dash-actions"><button className="dash-icon-button" aria-label="Previous page" disabled={currentPage <= 1 || query.isValidating} onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setExpandedLogId(null); }}><ChevronLeft size={16} /></button><span>Page {currentPage} of {pages}</span><button className="dash-icon-button" aria-label="Next page" disabled={currentPage >= pages || query.isValidating} onClick={() => { setCurrentPage(p => Math.min(pages, p + 1)); setExpandedLogId(null); }}><ChevronRight size={16} /></button></div></div>
    </section>
  </div>;
}

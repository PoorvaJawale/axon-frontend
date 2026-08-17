"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Copy, Check } from "lucide-react";

export type WebhookLogEntry = {
  id: string;
  time: string;
  agentId: string;
  actionType: "email" | "database" | "payment" | "chat" | "api_call";
  layerTriggered: string;
  result: "PASS" | "BLOCK" | "ASYNC FLAG";
  reason: string;
  outputContent: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const mono = "var(--font-geist-mono)";
const line = "1px solid rgba(140,255,190,.1)";
const panel = "#0a0d0c";
const COLS = "26px 80px 150px 100px 130px 92px 1fr";

export default function LogsPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [resultFilter, setResultFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearch(search); setCurrentPage(1); }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const queryParams = new URLSearchParams({
    page: currentPage.toString(),
    limit: "10",
    result: resultFilter,
    actionType: actionFilter,
    search: debouncedSearch,
  });

  const { data, isLoading } = useSWR(`/webhook/logs?${queryParams.toString()}`, fetcher, { refreshInterval: 10000, revalidateOnFocus: true });
  const logs: WebhookLogEntry[] = data?.logs ?? [];
  const pagination = data?.pagination ?? { currentPage: 1, totalPages: 1, totalCount: 0 };

  const verdictColor = (r: string) => (r === "PASS" ? "#37e39b" : r === "BLOCK" ? "#ff5f56" : "#ffb347");
  const verdictLabel = (r: string) => (r === "ASYNC FLAG" ? "FLAG" : r);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "axRise .35s ease both" }}>
      {/* Header */}
      <div>
        <h1 style={{ margin: 0, font: "700 30px/1.1 var(--font-geist-sans)", letterSpacing: "-.035em" }}>Validation logs</h1>
        <p style={{ margin: "8px 0 0", font: "400 13px/1.4 var(--font-geist-sans)", color: "#8b9a93" }}>Every request Axon has judged, with the raw output it saw.</p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, border: line, borderRadius: 9, background: "#0d100f", padding: "9px 12px", minWidth: 280, flex: 1 }}>
          <Search style={{ width: 14, height: 14, color: "#46534d" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="agent_id, reason, output…" className="ax-mono"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", font: `400 12px/1 ${mono}`, color: "#e8edea" }} />
        </div>
        <div style={{ display: "flex", border: line, borderRadius: 9, background: "#0d100f", overflow: "hidden" }}>
          {["All", "PASS", "BLOCK", "ASYNC FLAG"].map((r) => (
            <button key={r} onClick={() => { setResultFilter(r); setCurrentPage(1); }} className="ax-mono" style={{ font: `600 10.5px/1 ${mono}`, padding: "10px 12px", border: "none", cursor: "pointer", color: resultFilter === r ? "#04150d" : "#5b6b64", background: resultFilter === r ? "#37e39b" : "transparent" }}>{r === "ASYNC FLAG" ? "FLAG" : r}</button>
          ))}
        </div>
        <div style={{ position: "relative" }}>
          <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }} className="ax-mono"
            style={{ appearance: "none", border: line, borderRadius: 9, background: "#0d100f", padding: "10px 30px 10px 12px", font: `500 11px/1 ${mono}`, color: "#8b9a93", outline: "none", cursor: "pointer" }}>
            <option value="All">action: all</option>
            <option value="email">email</option>
            <option value="database">database</option>
            <option value="payment">payment</option>
            <option value="chat">chat</option>
            <option value="api_call">api_call</option>
          </select>
          <ChevronDown style={{ width: 13, height: 13, color: "#5b6b64", position: "absolute", right: 10, top: 11, pointerEvents: "none" }} />
        </div>
        <div style={{ flex: 1 }} />
        <span className="ax-mono" style={{ font: `500 11px/1 ${mono}`, color: "#46534d" }}>{pagination.totalCount.toLocaleString()} entries</span>
      </div>

      {/* Table */}
      <div style={{ border: line, borderRadius: 14, background: panel, overflow: "hidden" }}>
        <div className="ax-mono" style={{ display: "grid", gridTemplateColumns: COLS, padding: "11px 18px", borderBottom: line, background: "#0d100f", font: `600 9px/1 ${mono}`, letterSpacing: ".14em", color: "#46534d" }}>
          <span></span><span>TIME</span><span>AGENT ID</span><span>ACTION</span><span>LAYER</span><span>RESULT</span><span>REASON</span>
        </div>

        {isLoading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#5b6b64", font: "400 12px/1 var(--font-geist-sans)" }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#5b6b64", font: "400 13px/1 var(--font-geist-sans)" }}>No logs match your filters.</div>
        ) : (
          logs.map((log) => {
            const expanded = expandedLogId === log.id;
            const vc = verdictColor(log.result);
            return (
              <React.Fragment key={log.id}>
                <div onClick={() => setExpandedLogId(expanded ? null : log.id)}
                  style={{ display: "grid", gridTemplateColumns: COLS, padding: "13px 18px", borderBottom: "1px solid rgba(140,255,190,.05)", alignItems: "center", cursor: "pointer", background: expanded ? "rgba(55,227,155,.03)" : log.result === "BLOCK" ? "rgba(255,95,86,.04)" : "transparent" }}>
                  {expanded ? <ChevronUp style={{ width: 13, height: 13, color: "#8b9a93" }} /> : <ChevronDown style={{ width: 13, height: 13, color: "#46534d" }} />}
                  <span className="ax-mono" style={{ font: `400 11px/1 ${mono}`, color: "#5b6b64" }}>{(log.time || "").slice(-8)}</span>
                  <span className="ax-mono" style={{ font: `400 11px/1 ${mono}`, color: "#e8edea", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{log.agentId}</span>
                  <span style={{ font: "500 12px/1 var(--font-geist-sans)", textTransform: "capitalize" }}>{log.actionType}</span>
                  <span className="ax-mono" style={{ font: `400 11px/1 ${mono}`, color: "#8b9a93" }}>{log.layerTriggered}</span>
                  <span><span className="ax-mono" style={{ font: `700 9px/1 ${mono}`, color: vc, background: vc + "1a", border: `1px solid ${vc}47`, borderRadius: 5, padding: "4px 6px" }}>{verdictLabel(log.result)}</span></span>
                  <span style={{ font: "400 12px/1.3 var(--font-geist-sans)", color: "#8b9a93", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.reason}</span>
                </div>
                {expanded && (
                  <div style={{ padding: "0 18px 16px", borderBottom: "1px solid rgba(140,255,190,.05)", background: log.result === "BLOCK" ? "rgba(255,95,86,.04)" : "rgba(55,227,155,.02)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14 }} className="ax-log-detail">
                      <div style={{ border: line, borderRadius: 10, background: "#080b0a", overflow: "hidden" }}>
                        <div className="ax-mono" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderBottom: "1px solid rgba(140,255,190,.08)", font: `600 9px/1 ${mono}`, letterSpacing: ".14em", color: "#5b6b64" }}>
                          <span>RAW AGENT OUTPUT</span>
                          <CopyBtn text={log.outputContent} />
                        </div>
                        <pre className="ax-mono" style={{ margin: 0, padding: 13, font: `400 11px/1.7 ${mono}`, color: "#8b9a93", overflow: "auto", whiteSpace: "pre-wrap", maxHeight: 200 }}>{log.outputContent}</pre>
                      </div>
                      <div style={{ border: line, borderRadius: 10, background: "#080b0a", padding: 13 }}>
                        <div className="ax-mono" style={{ font: `600 9px/1 ${mono}`, letterSpacing: ".14em", color: "#5b6b64" }}>DECISION</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12, font: `500 11px/1 ${mono}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#8b9a93" }}>layer</span><span style={{ color: "#c3cec8" }}>{log.layerTriggered}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#8b9a93" }}>result</span><span style={{ color: vc }}>{log.result}</span></div>
                        </div>
                        <div className="ax-mono" style={{ marginTop: 13, paddingTop: 11, borderTop: "1px solid rgba(140,255,190,.08)", font: `400 10.5px/1.5 ${mono}`, color: "#5b6b64" }}>{log.reason}</div>
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}

        {/* Pagination */}
        {logs.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", borderTop: line, background: "#0d100f" }}>
            <span className="ax-mono" style={{ font: `400 11px/1 ${mono}`, color: "#5b6b64" }}>Showing {logs.length} of {pagination.totalCount.toLocaleString()}</span>
            <div className="ax-mono" style={{ display: "flex", alignItems: "center", gap: 8, font: `500 11px/1 ${mono}`, color: "#8b9a93" }}>
              <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} style={{ border: line, borderRadius: 7, padding: "6px 8px", display: "flex", background: "transparent", color: "inherit", cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.4 : 1 }}><ChevronLeft style={{ width: 13, height: 13 }} /></button>
              <span>page <span style={{ color: "#e8edea" }}>{currentPage}</span> / {pagination.totalPages}</span>
              <button onClick={() => setCurrentPage((p) => Math.min(p + 1, pagination.totalPages))} disabled={currentPage === pagination.totalPages} style={{ border: line, borderRadius: 7, padding: "6px 8px", display: "flex", background: "transparent", color: "inherit", cursor: currentPage === pagination.totalPages ? "not-allowed" : "pointer", opacity: currentPage === pagination.totalPages ? 0.4 : 1 }}><ChevronRight style={{ width: 13, height: 13 }} /></button>
            </div>
          </div>
        )}
      </div>

      <style>{`@media (max-width: 900px){ .ax-log-detail { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ax-mono" style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "#8b9a93", cursor: "pointer", font: "600 9px/1 var(--font-geist-mono)", letterSpacing: ".1em" }}>
      {copied ? <Check style={{ width: 12, height: 12, color: "#37e39b" }} /> : <Copy style={{ width: 12, height: 12 }} />}{copied ? "COPIED" : "COPY"}
    </button>
  );
}

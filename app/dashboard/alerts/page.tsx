"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Check, ShieldPlus } from "lucide-react";

type Alert = {
  id: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  agentId: string;
  actionType: string;
  description: string;
  blockedOutput: string;
  timestamp: string;
  reviewed?: boolean;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const mono = "var(--font-geist-mono)";
const line = "1px solid rgba(140,255,190,.1)";
const panel = "#0a0d0c";

export default function AlertsPage() {
  const [filter, setFilter] = useState<"All" | "Unreviewed" | "Reviewed">("Unreviewed");

  const { data, isLoading, mutate } = useSWR(`/webhook/alerts?filter=${filter}`, fetcher, { refreshInterval: 15000, revalidateOnFocus: true });
  const alerts: Alert[] = data?.alerts ?? [];

  const handleMarkAsReviewed = async (alertId: string, reviewedState: boolean) => {
    try {
      const res = await fetch("/webhook/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alertId, reviewed: reviewedState }) });
      if (res.ok) mutate();
    } catch (err) { console.error("Failed to update alert status:", err); }
  };

  const high = alerts.filter((a) => a.severity === "HIGH").length;
  const medium = alerts.filter((a) => a.severity === "MEDIUM").length;
  const featured = alerts[0] ?? null;
  const rest = alerts.slice(1);

  const sevColor = (s: string) => (s === "HIGH" ? "#ff5f56" : s === "MEDIUM" ? "#ffb347" : "#a78bfa");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, animation: "axRise .35s ease both" }}>
      {/* Header + filter */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, font: "700 30px/1.1 var(--font-geist-sans)", letterSpacing: "-.035em" }}>Security alerts</h1>
          <p style={{ margin: "8px 0 0", font: "400 13px/1.4 var(--font-geist-sans)", color: "#8b9a93" }}>
            Blocks that need a human decision.{high + medium > 0 ? ` ${alerts.length} in view.` : " All clear."}
          </p>
        </div>
        <div style={{ display: "flex", border: line, borderRadius: 9, background: "#0d100f", overflow: "hidden" }}>
          {(["All", "Unreviewed", "Reviewed"] as const).map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)} className="ax-mono" style={{ font: `600 10.5px/1 ${mono}`, padding: "10px 13px", border: "none", cursor: "pointer", color: filter === tab ? "#04150d" : "#5b6b64", background: filter === tab ? "#37e39b" : "transparent", textTransform: "uppercase", letterSpacing: ".04em" }}>{tab}</button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }} className="ax-alert-stats">
        <div style={{ border: "1px solid rgba(255,95,86,.24)", borderRadius: 12, background: "rgba(255,95,86,.05)", padding: "15px 17px" }}>
          <div className="ax-mono" style={{ font: `600 9.5px/1 ${mono}`, letterSpacing: ".16em", color: "#ff9b95" }}>HIGH SEVERITY</div>
          <div style={{ marginTop: 10, font: "700 26px/1 var(--font-geist-sans)", color: "#ff5f56" }}>{high}</div>
        </div>
        <div style={{ border: "1px solid rgba(255,179,71,.24)", borderRadius: 12, background: "rgba(255,179,71,.05)", padding: "15px 17px" }}>
          <div className="ax-mono" style={{ font: `600 9.5px/1 ${mono}`, letterSpacing: ".16em", color: "#ffd39c" }}>MEDIUM</div>
          <div style={{ marginTop: 10, font: "700 26px/1 var(--font-geist-sans)", color: "#ffb347" }}>{medium}</div>
        </div>
        <div style={{ border: line, borderRadius: 12, background: panel, padding: "15px 17px" }}>
          <div className="ax-mono" style={{ font: `600 9.5px/1 ${mono}`, letterSpacing: ".16em", color: "#5b6b64" }}>IN VIEW</div>
          <div style={{ marginTop: 10, font: "700 26px/1 var(--font-geist-sans)" }}>{alerts.length}</div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#5b6b64", font: "400 13px/1 var(--font-geist-sans)" }}>Loading alerts…</div>
      ) : alerts.length === 0 ? (
        <div style={{ border: line, borderRadius: 14, background: panel, padding: 60, textAlign: "center" }}>
          <Check style={{ width: 34, height: 34, color: "#37e39b", margin: "0 auto 12px" }} />
          <div style={{ font: "700 15px/1 var(--font-geist-sans)" }}>All clear</div>
          <p style={{ margin: "8px 0 0", font: "400 12px/1.4 var(--font-geist-sans)", color: "#8b9a93" }}>No {filter !== "All" ? filter.toLowerCase() : ""} alerts in the queue.</p>
        </div>
      ) : (
        <>
          {/* Featured alert */}
          {featured && (
            <div style={{ border: `1px solid ${sevColor(featured.severity)}42`, borderRadius: 14, background: `linear-gradient(180deg,${sevColor(featured.severity)}12,#0a0d0c 45%)`, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${sevColor(featured.severity)}29`, flexWrap: "wrap" }}>
                <span className="ax-mono" style={{ font: `700 9px/1 ${mono}`, letterSpacing: ".14em", color: sevColor(featured.severity), border: `1px solid ${sevColor(featured.severity)}59`, background: `${sevColor(featured.severity)}1f`, borderRadius: 5, padding: "5px 7px" }}>{featured.severity}</span>
                <span className="ax-mono" style={{ font: `400 11px/1 ${mono}`, color: "#5b6b64" }}>{featured.timestamp}</span>
                <div style={{ flex: 1 }} />
                <button onClick={() => handleMarkAsReviewed(featured.id, !featured.reviewed)} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid rgba(55,227,155,.3)", borderRadius: 8, background: "rgba(55,227,155,.1)", color: "#37e39b", font: "600 11px/1 var(--font-geist-sans)", padding: "9px 12px", cursor: "pointer" }}>
                  <Check style={{ width: 13, height: 13 }} />{featured.reviewed ? "Reviewed" : "Mark reviewed"}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 330px" }} className="ax-alert-detail">
                <div style={{ padding: 20, borderRight: `1px solid ${sevColor(featured.severity)}24` }}>
                  <h3 style={{ margin: 0, font: "700 19px/1.25 var(--font-geist-sans)", letterSpacing: "-.02em" }}>{featured.title}</h3>
                  <p style={{ margin: "11px 0 0", font: "400 13px/1.6 var(--font-geist-sans)", color: "#8b9a93", maxWidth: 560 }}>{featured.description}</p>
                  <div className="ax-mono" style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 16, font: `400 11px/1 ${mono}`, color: "#5b6b64" }}>
                    <span>agent_id: <span style={{ color: "#c3cec8" }}>{featured.agentId}</span></span>
                    <span>action: <span style={{ color: "#c3cec8" }}>{featured.actionType}</span></span>
                  </div>
                  <div style={{ marginTop: 18, border: `1px solid ${sevColor(featured.severity)}33`, borderRadius: 10, background: "#080b0a", overflow: "hidden" }}>
                    <div className="ax-mono" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderBottom: `1px solid ${sevColor(featured.severity)}29`, font: `600 9px/1 ${mono}`, letterSpacing: ".14em", color: "#5b6b64" }}>
                      <span>BLOCKED OUTPUT</span>
                    </div>
                    <pre className="ax-mono" style={{ margin: 0, padding: 13, font: `400 11px/1.75 ${mono}`, color: "#ff9b95", overflow: "auto", whiteSpace: "pre-wrap" }}>{featured.blockedOutput}</pre>
                  </div>
                </div>
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <div className="ax-mono" style={{ font: `600 9px/1 ${mono}`, letterSpacing: ".16em", color: "#5b6b64" }}>DETAILS</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, font: `500 11px/1 ${mono}`, color: "#8b9a93" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>severity</span><span style={{ color: sevColor(featured.severity) }}>{featured.severity}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>action</span><span style={{ color: "#c3cec8" }}>{featured.actionType}</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>verdict</span><span style={{ color: "#ff5f56" }}>BLOCK</span></div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}><span>status</span><span style={{ color: featured.reviewed ? "#37e39b" : "#ffb347" }}>{featured.reviewed ? "reviewed" : "unreviewed"}</span></div>
                    </div>
                  </div>
                  <button onClick={() => handleMarkAsReviewed(featured.id, !featured.reviewed)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid rgba(140,255,190,.14)", borderRadius: 8, background: "#0f1312", color: "#c3cec8", font: "600 11px/1 var(--font-geist-sans)", padding: "10px", cursor: "pointer" }}>
                    <ShieldPlus style={{ width: 13, height: 13 }} />{featured.reviewed ? "Mark unreviewed" : "Mark reviewed"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Compact rows */}
          {rest.map((a) => (
            <div key={a.id} style={{ border: `1px solid ${sevColor(a.severity)}2e`, borderRadius: 14, background: panel, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16 }}>
              <span className="ax-mono" style={{ font: `700 9px/1 ${mono}`, letterSpacing: ".14em", color: sevColor(a.severity), border: `1px solid ${sevColor(a.severity)}52`, borderRadius: 5, padding: "5px 7px", flex: "none" }}>{a.severity === "MEDIUM" ? "MED" : a.severity}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "700 14px/1.3 var(--font-geist-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                <div className="ax-mono" style={{ marginTop: 6, font: `400 11px/1 ${mono}`, color: "#5b6b64" }}>{a.agentId} · {a.actionType} · {a.timestamp}</div>
              </div>
              <button onClick={() => handleMarkAsReviewed(a.id, !a.reviewed)} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid rgba(55,227,155,.25)", borderRadius: 8, background: "rgba(55,227,155,.08)", color: "#37e39b", font: "600 10.5px/1 var(--font-geist-sans)", padding: "8px 11px", cursor: "pointer", flex: "none" }}>
                <Check style={{ width: 12, height: 12 }} />{a.reviewed ? "Reviewed" : "Review"}
              </button>
            </div>
          ))}
        </>
      )}

      <style>{`@media (max-width: 900px){ .ax-alert-stats { grid-template-columns: 1fr !important; } .ax-alert-detail { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

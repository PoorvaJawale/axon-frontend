"use client";

import React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Activity,
  CircleCheck,
  CircleX,
  Clock,
  ArrowUpRight,
  TriangleAlert,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const mono = "var(--font-geist-mono)";
const line = "1px solid rgba(140,255,190,.1)";
const panel = "#0a0d0c";

type Log = { id: string; time: string; actionType: string; result: "PASS" | "BLOCK" | "ASYNC FLAG"; reason: string };
type Alert = { id: string; severity: "HIGH" | "MEDIUM" | "LOW"; title: string; agentId: string; description: string; blockedOutput: string; timestamp: string };

export default function DashboardPage() {
  const { data: logsData, isLoading: logsLoading } = useSWR("/webhook/logs", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });
  const { data: alertsData } = useSWR("/webhook/alerts", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });

  const logs: Log[] = logsData?.logs ?? [];
  const stats = logsData?.stats ?? { total: 0, passed: 0, blocked: 0, asyncFlags: 0 };
  const alerts: Alert[] = alertsData?.alerts ?? [];
  const latestAlert = alerts[0] ?? null;
  const passPct = stats.total ? Math.round((stats.passed / stats.total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, animation: "axRise .35s ease both" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
        <div>
          <h1 style={{ margin: 0, font: "700 30px/1.1 var(--font-geist-sans)", letterSpacing: "-.035em" }}>Overview</h1>
          <p style={{ margin: "8px 0 0", font: "400 13px/1.4 var(--font-geist-sans)", color: "#8b9a93" }}>
            Every validation decision from the last 24 hours.
          </p>
        </div>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 7, border: line, borderRadius: 9, background: "#0d100f", padding: "9px 12px", font: "600 11px/1 var(--font-geist-sans)", color: "#c3cec8" }}>
          ← Home
        </Link>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "rgba(140,255,190,.09)", border: line, borderRadius: 14, overflow: "hidden" }} className="ax-stat-grid">
        <StatCard label="TOTAL VALIDATIONS" value={stats.total} icon={<Activity style={{ width: 15, height: 15, color: "#5b6b64" }} />} loading={logsLoading}>
          <ProportionBar passed={stats.passed} blocked={stats.blocked} flags={stats.asyncFlags} />
        </StatCard>
        <StatCard label="PASSED" value={stats.passed} valueColor="#37e39b" icon={<CircleCheck style={{ width: 15, height: 15, color: "#37e39b" }} />} loading={logsLoading}>
          <Meter pct={passPct} color="#37e39b" note={`${passPct}% of traffic`} />
        </StatCard>
        <StatCard label="BLOCKED" value={stats.blocked} valueColor="#ff5f56" icon={<CircleX style={{ width: 15, height: 15, color: "#ff5f56" }} />} loading={logsLoading}>
          <Meter pct={stats.total ? (stats.blocked / stats.total) * 100 : 0} color="#ff5f56" note="needs review" />
        </StatCard>
        <StatCard label="ASYNC FLAGS" value={stats.asyncFlags} valueColor="#ffb347" icon={<Clock style={{ width: 15, height: 15, color: "#ffb347" }} />} loading={logsLoading}>
          <Meter pct={stats.total ? (stats.asyncFlags / stats.total) * 100 : 0} color="#ffb347" note="awaiting review" />
        </StatCard>
      </div>

      {/* Main split */}
      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 18, alignItems: "start" }} className="ax-over-grid">
        {/* Recent decisions */}
        <div style={{ border: line, borderRadius: 14, background: panel, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 20px", borderBottom: line }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, font: "700 14px/1 var(--font-geist-sans)" }}>Recent decisions</h2>
              <span className="ax-mono" style={{ display: "flex", alignItems: "center", gap: 5, font: `500 9.5px/1 ${mono}`, color: "#37e39b" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#37e39b", animation: "axPulse 1.6s ease-in-out infinite" }} />streaming
              </span>
            </div>
            <Link href="/dashboard/logs" className="ax-mono" style={{ display: "flex", alignItems: "center", gap: 5, font: `600 10.5px/1 ${mono}`, color: "#37e39b" }}>
              VIEW ALL <ArrowUpRight style={{ width: 12, height: 12 }} />
            </Link>
          </div>
          <div className="ax-mono" style={{ display: "grid", gridTemplateColumns: "78px 118px 1fr 88px", padding: "10px 20px", borderBottom: "1px solid rgba(140,255,190,.07)", font: `600 9px/1 ${mono}`, letterSpacing: ".14em", color: "#46534d" }}>
            <span>TIME</span><span>ACTION</span><span>REASON</span><span style={{ textAlign: "right" }}>RESULT</span>
          </div>
          {logsLoading ? (
            <div style={{ padding: 30, textAlign: "center", color: "#5b6b64", font: "400 12px/1 var(--font-geist-sans)" }}>Loading…</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#5b6b64", font: "400 13px/1 var(--font-geist-sans)" }}>No decisions yet.</div>
          ) : (
            logs.slice(0, 8).map((log, i) => (
              <div key={log.id} style={{ display: "grid", gridTemplateColumns: "78px 118px 1fr 88px", padding: "13px 20px", borderBottom: i < 7 ? "1px solid rgba(140,255,190,.05)" : "none", alignItems: "center" }}>
                <span className="ax-mono" style={{ font: `400 11px/1 ${mono}`, color: "#5b6b64" }}>{(log.time || "").slice(-8)}</span>
                <span style={{ font: "500 12px/1 var(--font-geist-sans)", textTransform: "capitalize" }}>{log.actionType}</span>
                <span style={{ font: "400 12px/1.3 var(--font-geist-sans)", color: "#8b9a93", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 10 }}>{log.reason}</span>
                <span style={{ textAlign: "right" }}><Verdict result={log.result} /></span>
              </div>
            ))
          )}
        </div>

        {/* Right: latest block */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {!latestAlert ? (
            <div style={{ border: line, borderRadius: 14, background: panel, padding: 24, textAlign: "center" }}>
              <CircleCheck style={{ width: 28, height: 28, color: "#37e39b", margin: "0 auto 10px" }} />
              <div style={{ font: "700 14px/1 var(--font-geist-sans)" }}>System secure</div>
              <p style={{ margin: "8px 0 0", font: "400 12px/1.4 var(--font-geist-sans)", color: "#8b9a93" }}>No recent blocks detected.</p>
            </div>
          ) : (
            <div style={{ border: "1px solid rgba(255,95,86,.28)", borderRadius: 14, background: "linear-gradient(180deg,rgba(255,95,86,.08),#0a0d0c 60%)", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, font: "700 11px/1 var(--font-geist-sans)", color: "#ff5f56" }}>
                  <TriangleAlert style={{ width: 14, height: 14 }} />Latest block
                </div>
                <span className="ax-mono" style={{ font: `700 9px/1 ${mono}`, letterSpacing: ".14em", color: "#ff5f56", border: "1px solid rgba(255,95,86,.35)", borderRadius: 5, padding: "4px 6px" }}>{latestAlert.severity}</span>
              </div>
              <h3 style={{ margin: "14px 0 0", font: "700 15px/1.3 var(--font-geist-sans)" }}>{latestAlert.title}</h3>
              <div className="ax-mono" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10, font: `400 10px/1 ${mono}`, color: "#5b6b64" }}>
                <span>agent: {latestAlert.agentId}</span><span>{latestAlert.timestamp}</span>
              </div>
              <div className="ax-mono" style={{ marginTop: 13, border: "1px solid rgba(255,95,86,.2)", borderRadius: 9, background: "#080b0a", padding: "11px 12px", font: `400 10.5px/1.65 ${mono}`, color: "#ff9b95", overflow: "auto", maxHeight: 120 }}>
                {latestAlert.description}
              </div>
              <Link href="/dashboard/alerts" style={{ display: "block", textAlign: "center", width: "100%", marginTop: 14, border: "1px solid rgba(255,95,86,.3)", borderRadius: 9, background: "rgba(255,95,86,.1)", color: "#ff9b95", font: "600 11px/1 var(--font-geist-sans)", padding: 11 }}>
                Open in alerts
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1000px) {
          .ax-over-grid { grid-template-columns: 1fr !important; }
          .ax-stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, valueColor = "#e8edea", icon, loading, children }: { label: string; value: number; valueColor?: string; icon: React.ReactNode; loading?: boolean; children?: React.ReactNode }) {
  return (
    <div style={{ background: panel, padding: "20px 22px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="ax-mono" style={{ font: "600 9.5px/1 var(--font-geist-mono)", letterSpacing: ".16em", color: "#5b6b64" }}>{label}</span>
        {icon}
      </div>
      <div style={{ marginTop: 14, font: "700 34px/1 var(--font-geist-sans)", letterSpacing: "-.04em", color: valueColor }}>
        {loading ? "—" : value.toLocaleString()}
      </div>
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

function Meter({ pct, color, note }: { pct: number; color: string; note: string }) {
  return (
    <>
      <div style={{ height: 5, borderRadius: 999, background: "#141a17", overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color }} />
      </div>
      <div className="ax-mono" style={{ marginTop: 9, font: "500 10px/1 var(--font-geist-mono)", color: "#5b6b64" }}>{note}</div>
    </>
  );
}

function ProportionBar({ passed, blocked, flags }: { passed: number; blocked: number; flags: number }) {
  const total = passed + blocked + flags || 1;
  const seg = (n: number) => `${(n / total) * 100}%`;
  return (
    <>
      <div style={{ display: "flex", height: 6, borderRadius: 999, overflow: "hidden", background: "#141a17" }}>
        {passed > 0 && <div style={{ width: seg(passed), background: "#37e39b" }} />}
        {blocked > 0 && <div style={{ width: seg(blocked), background: "#ff5f56" }} />}
        {flags > 0 && <div style={{ width: seg(flags), background: "#ffb347" }} />}
      </div>
      <div className="ax-mono" style={{ display: "flex", gap: 12, marginTop: 9, font: "500 9px/1 var(--font-geist-mono)", color: "#5b6b64" }}>
        <span><span style={{ color: "#37e39b" }}>■</span> pass</span>
        <span><span style={{ color: "#ff5f56" }}>■</span> block</span>
        <span><span style={{ color: "#ffb347" }}>■</span> flag</span>
      </div>
    </>
  );
}

function Verdict({ result }: { result: "PASS" | "BLOCK" | "ASYNC FLAG" }) {
  const c = result === "PASS" ? "#37e39b" : result === "BLOCK" ? "#ff5f56" : "#ffb347";
  const label = result === "ASYNC FLAG" ? "FLAG" : result;
  return (
    <span className="ax-mono" style={{ font: "700 9px/1 var(--font-geist-mono)", letterSpacing: ".1em", color: c, background: c + "1a", border: `1px solid ${c}47`, borderRadius: 5, padding: "4px 6px" }}>{label}</span>
  );
}

"use client";

import React from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { CircleCheckBig } from "lucide-react";

const mono = "var(--font-geist-mono)";
const line = "1px solid rgba(140,255,190,.1)";
const panel = "#0a0d0c";

const services = [
  { name: "Validation API", uptime: "99.9%", flag: -1 },
  { name: "Schema validator", uptime: "99.9%", flag: -1 },
  { name: "Semantic judge", uptime: "99.8%", flag: 5 },
  { name: "Dashboard", uptime: "99.9%", flag: -1 },
  { name: "Background validator", uptime: "99.7%", flag: 2 },
];

function UptimeBars({ flag }: { flag: number }) {
  return (
    <span style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 20 }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} style={{ flex: 1, height: "100%", background: i === flag ? "#ffb347" : "#37e39b", borderRadius: 1 }} />
      ))}
    </span>
  );
}

export default function StatusPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#070908" }}>
      <Header />
      <main style={{ flex: 1, animation: "axRise .35s ease both" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 30px 64px", display: "flex", flexDirection: "column", gap: 26 }}>
          <div>
            <h1 style={{ margin: 0, font: "700 38px/1.08 var(--font-geist-sans)", letterSpacing: "-.04em" }}>System status</h1>
            <p style={{ margin: "10px 0 0", font: "400 14px/1.5 var(--font-geist-sans)", color: "#8b9a93" }}>Live health of every Axon service.</p>
          </div>

          {/* Operational banner */}
          <div style={{ display: "flex", alignItems: "center", gap: 15, border: "1px solid rgba(55,227,155,.3)", borderRadius: 14, background: "linear-gradient(180deg,rgba(55,227,155,.1),rgba(55,227,155,.04))", padding: "20px 22px" }}>
            <div style={{ width: 38, height: 38, flex: "none", borderRadius: 11, background: "rgba(55,227,155,.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#37e39b" }}>
              <CircleCheckBig style={{ width: 20, height: 20 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="ax-mono" style={{ font: `700 13px/1 ${mono}`, letterSpacing: ".12em", color: "#37e39b" }}>ALL SYSTEMS OPERATIONAL</div>
              <div style={{ marginTop: 7, font: "400 12.5px/1 var(--font-geist-sans)", color: "#8b9a93" }}>No incidents in the last 30 days.</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ font: "700 20px/1 var(--font-geist-sans)", letterSpacing: "-.02em" }}>99.9%</div>
              <div className="ax-mono" style={{ marginTop: 5, font: `500 9.5px/1 ${mono}`, letterSpacing: ".12em", color: "#5b6b64" }}>90-DAY UPTIME</div>
            </div>
          </div>

          {/* Services table */}
          <div style={{ border: line, borderRadius: 14, background: panel, overflow: "hidden" }}>
            <div className="ax-mono" style={{ display: "grid", gridTemplateColumns: "1fr 190px 80px", padding: "11px 20px", borderBottom: line, background: "#0d100f", font: `600 9px/1 ${mono}`, letterSpacing: ".14em", color: "#46534d" }}>
              <span>SERVICE</span><span>LAST 90 DAYS</span><span style={{ textAlign: "right" }}>UPTIME</span>
            </div>
            {services.map((s, i) => (
              <div key={s.name} style={{ display: "grid", gridTemplateColumns: "1fr 190px 80px", padding: "15px 20px", borderBottom: i < services.length - 1 ? "1px solid rgba(140,255,190,.05)" : "none", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 9, font: "600 13px/1 var(--font-geist-sans)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#37e39b", animation: `axPulse 2.2s ease-in-out ${i * 0.3}s infinite` }} />{s.name}
                </span>
                <UptimeBars flag={s.flag} />
                <span className="ax-mono" style={{ textAlign: "right", font: `500 12px/1 ${mono}`, color: "#8b9a93" }}>{s.uptime}</span>
              </div>
            ))}
          </div>

          {/* Past incidents */}
          <div>
            <h2 style={{ margin: 0, font: "700 16px/1 var(--font-geist-sans)" }}>Past incidents</h2>
            <div style={{ marginTop: 14, border: line, borderRadius: 14, background: panel, padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className="ax-mono" style={{ font: `700 9px/1 ${mono}`, letterSpacing: ".14em", color: "#37e39b", border: "1px solid rgba(55,227,155,.28)", borderRadius: 5, padding: "5px 7px" }}>RESOLVED</span>
                <span className="ax-mono" style={{ font: `500 11px/1 ${mono}`, color: "#5b6b64" }}>June 1, 2026 · 12 min</span>
              </div>
              <h3 style={{ margin: "13px 0 0", font: "700 14.5px/1.3 var(--font-geist-sans)" }}>Elevated latency on semantic judge</h3>
              <p style={{ margin: "8px 0 0", maxWidth: 600, font: "400 12.5px/1.6 var(--font-geist-sans)", color: "#8b9a93" }}>Brief latency spike on the semantic validation layer lasting 12 minutes. Root cause identified and resolved. No validations were incorrectly passed.</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

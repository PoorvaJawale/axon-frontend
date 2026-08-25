"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ArrowRight, Terminal, ShieldCheck, Braces, Brain, Gavel } from "lucide-react";

const mono = "var(--font-geist-mono)";

export function Hero() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const handleGetApiKey = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(isSignedIn ? "/dashboard/api-keys" : "/sign-up");
  };

  return (
    <section style={{ position: "relative", overflow: "hidden", padding: "52px 40px 64px" }}>
      {/* grid + glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(55,227,155,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(55,227,155,.05) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse 90% 60% at 50% 0%,#000 30%,transparent 75%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: -260,
          width: 900,
          height: 520,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          background: "rgba(55,227,155,.13)",
          filter: "blur(140px)",
          animation: "axGlow 7s ease-in-out infinite",
        }}
      />

      <div
        className="ax-hero-grid"
        style={{
          position: "relative",
          maxWidth: 1240,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.05fr .95fr",
          gap: 64,
          alignItems: "center",
        }}
      >
        {/* Left: copy */}
        <div>
          <div
            className="ax-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              border: "1px solid rgba(140,255,190,.16)",
              borderRadius: 999,
              padding: "6px 12px 6px 9px",
              background: "rgba(13,16,15,.7)",
              font: `600 10px/1 ${mono}`,
              letterSpacing: ".14em",
              color: "#8b9a93",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#37e39b",
                animation: "axPulse 2s ease-in-out infinite",
              }}
            />
            AI OUTPUT VALIDATION MIDDLEWARE
          </div>
          <h1
            style={{
              margin: "18px 0 0",
              font: "800 58px/.98 var(--font-geist-sans)",
              letterSpacing: "-.045em",
              textWrap: "balance",
            }}
          >
            Nothing your agent<br />writes reaches prod<br />
            <span style={{ color: "#37e39b" }}>unverified.</span>
          </h1>
          <p
            style={{
              margin: "18px 0 0",
              maxWidth: 508,
              font: "400 16px/1.55 var(--font-geist-sans)",
              color: "#8b9a93",
            }}
          >
            Axon sits between your AI agents and your production systems. Every output
            passes schema validation, a semantic judge, and your own policy rules before
            it is allowed to execute.
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
            <button
              onClick={handleGetApiKey}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                font: "600 14px/1 var(--font-geist-sans)",
                color: "#04150d",
                background: "#37e39b",
                padding: "14px 20px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
              }}
            >
              Get API key <ArrowRight style={{ width: 15, height: 15 }} />
            </button>
            <Link
              href="/docs"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                font: "600 14px/1 var(--font-geist-sans)",
                color: "#e8edea",
                border: "1px solid rgba(140,255,190,.16)",
                background: "#0d100f",
                padding: "14px 20px",
                borderRadius: 10,
              }}
            >
              <Terminal style={{ width: 15, height: 15 }} /> Read the docs
            </Link>
          </div>

          {/* stat strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 1,
              marginTop: 32,
              background: "var(--ax-line)",
              border: "1px solid var(--ax-line)",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {[
              ["41", "ms", "P50 ADDED LATENCY"],
              ["3", "", "VALIDATION LAYERS"],
              ["99.9", "%", "API UPTIME"],
            ].map(([n, unit, label]) => (
              <div key={label} style={{ background: "#0a0d0c", padding: "18px 20px" }}>
                <div style={{ font: "700 26px/1 var(--font-geist-sans)", letterSpacing: "-.03em" }}>
                  {n}
                  {unit && <span style={{ fontSize: 14, color: "#5b6b64" }}>{unit}</span>}
                </div>
                <div
                  className="ax-mono"
                  style={{ marginTop: 7, font: `600 9px/1 ${mono}`, letterSpacing: ".16em", color: "#5b6b64" }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: pipeline card */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              border: "1px solid rgba(140,255,190,.13)",
              borderRadius: 16,
              background: "#0a0d0c",
              overflow: "hidden",
              boxShadow: "0 40px 90px -30px rgba(0,0,0,.9)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid var(--ax-line)",
                background: "#0d100f",
              }}
            >
              <div className="ax-mono" style={{ display: "flex", alignItems: "center", gap: 8, font: `600 10px/1 ${mono}`, letterSpacing: ".14em", color: "#8b9a93" }}>
                <ShieldCheck style={{ width: 13, height: 13, color: "#37e39b" }} /> PIPELINE · LIVE
              </div>
              <div className="ax-mono" style={{ font: `500 10px/1 ${mono}`, color: "#46534d" }}>agent_id: support-agent-01</div>
            </div>

            <div style={{ padding: "18px 16px 16px" }}>
              <div
                className="ax-mono"
                style={{
                  border: "1px dashed rgba(140,255,190,.16)",
                  borderRadius: 10,
                  background: "#080b0a",
                  padding: "12px 13px",
                  font: `400 11px/1.6 ${mono}`,
                  color: "#8b9a93",
                }}
              >
                <span style={{ color: "#46534d" }}>// incoming agent output</span>
                <br />
                {"{ "}
                <span style={{ color: "#a78bfa" }}>&quot;action_type&quot;</span>:{" "}
                <span style={{ color: "#37e39b" }}>&quot;payment&quot;</span>,<br />
                &nbsp;&nbsp;<span style={{ color: "#a78bfa" }}>&quot;amount&quot;</span>:{" "}
                <span style={{ color: "#ffb347" }}>248000</span>,<br />
                &nbsp;&nbsp;<span style={{ color: "#a78bfa" }}>&quot;destination&quot;</span>:{" "}
                <span style={{ color: "#37e39b" }}>&quot;acct_9f21&quot;</span> {"}"}
              </div>

              {/* scan connector */}
              <div style={{ height: 22, marginLeft: 20, borderLeft: "1px solid rgba(140,255,190,.16)", position: "relative", overflow: "hidden", marginTop: 6 }}>
                <div style={{ position: "absolute", left: -2, top: 0, width: 3, height: 8, background: "#37e39b", borderRadius: 2, animation: "axScan 2.6s linear infinite" }} />
              </div>

              <PipelineRow icon={<Braces style={{ width: 14, height: 14 }} />} color="#37e39b" title="Layer 1 · Schema" sub="payment.v3 · 6 fields · strict" verdict="PASS" />
              <Connector color="rgba(140,255,190,.16)" />
              <PipelineRow icon={<Brain style={{ width: 14, height: 14 }} />} color="#a78bfa" title="Layer 2 · Semantic judge" sub="intent aligned · confidence 0.96" verdict="PASS" />
              <Connector color="rgba(255,95,86,.3)" />
              <PipelineRow icon={<Gavel style={{ width: 14, height: 14 }} />} color="#ff5f56" title="Layer 3 · Policy" sub="amount > ₹50,000 requires human approval" subColor="#ff9b95" verdict="BLOCK" />

              <div
                className="ax-mono"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 16,
                  paddingTop: 14,
                  borderTop: "1px solid var(--ax-line)",
                  font: `500 10px/1 ${mono}`,
                  color: "#5b6b64",
                }}
              >
                <span>execution halted · 63ms</span>
                <span style={{ color: "#ff5f56" }}>alert dispatched → #sec-ops</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ax-hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

function Connector({ color }: { color: string }) {
  return <div style={{ height: 22, marginLeft: 20, borderLeft: `1px solid ${color}` }} />;
}

function PipelineRow({
  icon,
  color,
  title,
  sub,
  subColor = "#5b6b64",
  verdict,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  sub: string;
  subColor?: string;
  verdict: "PASS" | "BLOCK";
}) {
  const tint = color + "22";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: `1px solid ${color}39`,
        borderRadius: 10,
        background: color + "0d",
        padding: "12px 13px",
      }}
    >
      <div style={{ width: 26, height: 26, flex: "none", borderRadius: 7, background: tint, display: "flex", alignItems: "center", justifyContent: "center", color }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "600 12px/1.2 var(--font-geist-sans)" }}>{title}</div>
        <div className="ax-mono" style={{ font: "400 10px/1.3 var(--font-geist-mono)", color: subColor, marginTop: 3 }}>{sub}</div>
      </div>
      <span
        className="ax-mono"
        style={{
          font: "700 9px/1 var(--font-geist-mono)",
          letterSpacing: ".14em",
          color,
          border: `1px solid ${color}4d`,
          borderRadius: 5,
          padding: "4px 6px",
        }}
      >
        {verdict}
      </span>
    </div>
  );
}

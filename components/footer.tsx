import Link from "next/link";
import { Lock, Server, FileCheck, EyeOff } from "lucide-react";

const mono = "var(--font-geist-mono)";

const cols = [
  { head: "PRODUCT", links: [["Platform", "/#features"], ["Pricing", "/#pricing"], ["Changelog", "/changelog"]] },
  { head: "RESOURCES", links: [["Docs", "/docs"], ["API reference", "/api-reference"], ["Status", "/status"]] },
  { head: "COMPANY", links: [["About", "/about"], ["Blog", "/blog"], ["Careers", "/careers"]] },
];

export function Footer() {
  return (
    <>
      {/* Security strip */}
      <section id="security" style={{ padding: "64px 40px 0" }}>
        <div
          className="ax-sec-bar"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            border: "1px solid var(--ax-line)",
            borderRadius: 14,
            background: "#0a0d0c",
            padding: "26px 30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          <div className="ax-mono" style={{ font: `600 10px/1 ${mono}`, letterSpacing: ".16em", color: "#5b6b64" }}>
            BUILT FOR REVIEW BY YOUR SECURITY TEAM
          </div>
          <div style={{ display: "flex", gap: 26, flexWrap: "wrap", font: "500 12px/1 var(--font-geist-sans)", color: "#8b9a93" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Lock style={{ width: 14, height: 14, color: "#37e39b" }} />SOC 2 Type II in progress</span>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}><Server style={{ width: 14, height: 14, color: "#37e39b" }} />Data residency options</span>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}><FileCheck style={{ width: 14, height: 14, color: "#37e39b" }} />Immutable audit log</span>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}><EyeOff style={{ width: 14, height: 14, color: "#37e39b" }} />Zero output retention mode</span>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: 96, borderTop: "1px solid var(--ax-line)", background: "#090c0b", padding: "56px 40px 34px" }}>
        <div
          className="ax-foot-grid"
          style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr", gap: 40 }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, background: "linear-gradient(145deg,#37e39b,#159a63)", display: "flex", alignItems: "center", justifyContent: "center", color: "#04150d", font: "800 11px/1 var(--font-geist-sans)" }}>A</div>
              <span style={{ font: "800 15px/1 var(--font-geist-sans)", letterSpacing: "-.03em" }}>Axon</span>
            </div>
            <p style={{ margin: "14px 0 0", maxWidth: 280, font: "400 13px/1.6 var(--font-geist-sans)", color: "#5b6b64" }}>
              AI output validation middleware for production systems.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.head}>
              <div className="ax-mono" style={{ font: `600 9px/1 ${mono}`, letterSpacing: ".18em", color: "#46534d" }}>{c.head}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16, font: "400 13px/1 var(--font-geist-sans)" }}>
                {c.links.map(([label, href]) => (
                  <Link key={label} href={href} style={{ color: "#8b9a93" }}>{label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div
          className="ax-mono"
          style={{ maxWidth: 1240, margin: "38px auto 0", paddingTop: 22, borderTop: "1px solid rgba(140,255,190,.07)", display: "flex", justifyContent: "space-between", font: `400 11px/1 ${mono}`, color: "#46534d" }}
        >
          <span>© 2026 Axon. All rights reserved.</span>
          <span style={{ display: "flex", gap: 18 }}>
            <Link href="#" style={{ color: "#46534d" }}>Privacy</Link>
            <Link href="#" style={{ color: "#46534d" }}>Terms</Link>
          </span>
        </div>
      </footer>

      <style>{`
        @media (max-width: 780px) {
          .ax-foot-grid { grid-template-columns: 1fr 1fr !important; }
          .ax-sec-bar { flex-direction: column; align-items: flex-start !important; }
        }
      `}</style>
    </>
  );
}

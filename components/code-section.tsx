"use client";

const mono = "var(--font-geist-mono)";

const codeBlock = `const res = await fetch("https://api.axon.dev/validate", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-axon-YOUR_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    action_type: "payment",
    output: agentOutput,
    execution_endpoint: "https://your-app.com/execute"
  })
});

const { status, reason } = await res.json();
if (status === "PASS") execute(agentOutput);
else halt(reason);`;

const steps = [
  "Declare a schema per action type",
  "Send the agent output to /validate",
  "Execute only on PASS",
];

export function CodeSection() {
  return (
    <section style={{ padding: "110px 40px 0" }}>
      <div
        className="ax-int-grid"
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: ".85fr 1.15fr",
          gap: 56,
          alignItems: "center",
        }}
      >
        <div>
          <div className="ax-mono" style={{ font: `600 10px/1 ${mono}`, letterSpacing: ".16em", color: "#5b6b64" }}>
            02 — INTEGRATION
          </div>
          <h2 style={{ margin: "16px 0 0", font: "700 44px/1.05 var(--font-geist-sans)", letterSpacing: "-.035em" }}>
            One POST. Any stack.
          </h2>
          <p style={{ margin: "18px 0 0", font: "400 15px/1.65 var(--font-geist-sans)", color: "#8b9a93" }}>
            Wrap the call your agent already makes. If Axon returns{" "}
            <span className="ax-mono" style={{ color: "#37e39b" }}>PASS</span>, execute. If not,
            you have the reason, the layer, and the log line.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 1,
              marginTop: 30,
              border: "1px solid var(--ax-line)",
              borderRadius: 12,
              overflow: "hidden",
              background: "var(--ax-line)",
            }}
          >
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, background: "#0a0d0c", padding: "15px 16px" }}>
                <span
                  className="ax-mono"
                  style={{
                    width: 22,
                    height: 22,
                    flex: "none",
                    borderRadius: 6,
                    background: "rgba(55,227,155,.12)",
                    color: "#37e39b",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    font: `700 10px/1 ${mono}`,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ font: "500 13px/1.3 var(--font-geist-sans)", color: "#c3cec8" }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            border: "1px solid rgba(140,255,190,.13)",
            borderRadius: 14,
            background: "#0a0d0c",
            overflow: "hidden",
            boxShadow: "0 30px 70px -30px rgba(0,0,0,.9)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "0 10px", borderBottom: "1px solid var(--ax-line)", background: "#0d100f" }}>
            <span className="ax-mono" style={{ font: `600 11px/1 ${mono}`, color: "#37e39b", padding: "13px 12px", borderBottom: "2px solid #37e39b" }}>
              validate.ts
            </span>
            <span className="ax-mono" style={{ font: `600 11px/1 ${mono}`, color: "#46534d", padding: "13px 12px" }}>
              validate.py
            </span>
            <div style={{ flex: 1 }} />
            <span className="ax-mono" style={{ font: `500 10px/1 ${mono}`, color: "#46534d", padding: "0 8px" }}>COPY</span>
          </div>
          <pre
            className="ax-mono"
            style={{ margin: 0, padding: "20px 18px", font: `400 12.5px/1.75 ${mono}`, color: "#8b9a93", overflow: "auto" }}
          >
            {codeBlock}
          </pre>
          <div
            className="ax-mono"
            style={{ display: "flex", gap: 16, padding: "13px 18px", borderTop: "1px solid var(--ax-line)", background: "#0d100f", font: `500 10px/1 ${mono}`, color: "#46534d" }}
          >
            <span style={{ color: "#37e39b" }}>200 PASS</span>
            <span>403 BLOCK</span>
            <span>202 ASYNC FLAG</span>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .ax-int-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

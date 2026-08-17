"use client";

import { Braces, Brain, BellRing } from "lucide-react";

const mono = "var(--font-geist-mono)";

const layers = [
  {
    n: "01",
    color: "#37e39b",
    icon: <Braces style={{ width: 20, height: 20 }} />,
    title: "Schema validation",
    body: "Strict JSON contracts per action type. Malformed data never touches your database or your UI.",
    tags: ["strict types", "versioned", "<5ms"],
  },
  {
    n: "02",
    color: "#a78bfa",
    icon: <Brain style={{ width: 20, height: 20 }} />,
    title: "Semantic judge",
    body: "A judge model scores correctness, safety and intent alignment. Syntax-valid nonsense still gets caught.",
    tags: ["confidence score", "custom rubric"],
  },
  {
    n: "03",
    color: "#ffb347",
    icon: <BellRing style={{ width: 20, height: 20 }} />,
    title: "Policy & alerting",
    body: "Your business rules as code. Blocks route to Slack, PagerDuty or a webhook with the full payload attached.",
    tags: ["Slack", "PagerDuty", "webhook"],
  },
];

export function Features() {
  return (
    <section id="features" style={{ padding: "110px 40px 0" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div
          className="ax-feat-head"
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 40,
            paddingBottom: 28,
            borderBottom: "1px solid var(--ax-line)",
          }}
        >
          <div>
            <div className="ax-mono" style={{ font: `600 10px/1 ${mono}`, letterSpacing: ".16em", color: "#5b6b64" }}>
              01 — THE STACK
            </div>
            <h2 style={{ margin: "16px 0 0", font: "700 44px/1.05 var(--font-geist-sans)", letterSpacing: "-.035em" }}>
              Three layers, one call
            </h2>
          </div>
          <p style={{ maxWidth: 360, margin: 0, font: "400 15px/1.6 var(--font-geist-sans)", color: "#8b9a93" }}>
            Each layer fails closed. An output only executes when all three agree, and every
            decision is written to an immutable log.
          </p>
        </div>

        <div
          className="ax-feat-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 1,
            marginTop: 1,
            background: "var(--ax-line)",
          }}
        >
          {layers.map((l) => (
            <div key={l.n} style={{ background: "#070908", padding: "36px 30px 34px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span
                  className="ax-mono"
                  style={{ font: `700 52px/1 ${mono}`, color: l.color + "38", letterSpacing: "-.04em" }}
                >
                  {l.n}
                </span>
                <span style={{ color: l.color }}>{l.icon}</span>
              </div>
              <h3 style={{ margin: "26px 0 0", font: "700 21px/1.2 var(--font-geist-sans)", letterSpacing: "-.02em" }}>
                {l.title}
              </h3>
              <p style={{ margin: "12px 0 0", font: "400 14px/1.65 var(--font-geist-sans)", color: "#8b9a93" }}>
                {l.body}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 20 }}>
                {l.tags.map((t) => (
                  <span
                    key={t}
                    className="ax-mono"
                    style={{
                      font: `500 10px/1 ${mono}`,
                      color: "#8b9a93",
                      border: "1px solid rgba(140,255,190,.12)",
                      borderRadius: 5,
                      padding: "5px 7px",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .ax-feat-grid { grid-template-columns: 1fr !important; }
          .ax-feat-head { flex-direction: column; align-items: flex-start !important; }
        }
      `}</style>
    </section>
  );
}

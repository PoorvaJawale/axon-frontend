"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

const mono = "var(--font-geist-mono)";

const plans = [
  {
    name: "Free",
    tag: "FREE",
    price: "₹0",
    period: "one-time",
    description: "Try Axon with a one-time free allowance.",
    features: [
      "100 validations total · no monthly refill",
      "Schema validation",
      "Real-time developer dashboard",
      "REST API & webhooks",
      "7-day log retention",
      "Community support",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    name: "Pro",
    tag: "PRO",
    price: "₹799",
    period: "/month",
    description: "Production workloads with real traffic.",
    features: [
      "5,000 validations/month",
      "Semantic judge model",
      "Real-time alerts",
      "Custom schemas",
      "30-day log retention",
      "Priority support",
    ],
    cta: "Choose Pro",
    highlighted: true,
  },
  {
    name: "Enterprise",
    tag: "ENTERPRISE",
    price: "Custom",
    period: "",
    description: "Regulated environments and on-premise.",
    features: [
      "Unlimited validations",
      "Custom judge models",
      "SLA guarantee",
      "On-premise deployment",
      "Unlimited retention",
      "Dedicated support",
    ],
    cta: "Contact sales",
    highlighted: false,
  },
];

export function Pricing() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const handlePlanClick = (planName: string) => {
    if (planName === "Free") router.push(isSignedIn ? "/dashboard" : "/sign-up");
    else if (planName === "Pro") router.push(isSignedIn ? "/dashboard/billing" : "/sign-up");
    else router.push("/enterprise-contact");
  };

  return (
    <section id="pricing" style={{ padding: "72px 40px 0" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ textAlign: "center" }}>
          <div className="ax-mono" style={{ font: `600 10px/1 ${mono}`, letterSpacing: ".16em", color: "#5b6b64" }}>
            03 — PRICING
          </div>
          <h2 style={{ margin: "16px 0 0", font: "700 44px/1.05 var(--font-geist-sans)", letterSpacing: "-.035em" }}>
            Priced per validation, not per seat
          </h2>
        </div>

        <div
          className="ax-price-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginTop: 44, alignItems: "stretch" }}
        >
          {plans.map((plan) => (
            <div
              key={plan.name}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                height: "100%",
                borderRadius: 14,
                padding: 28,
                ...(plan.highlighted
                  ? {
                      border: "1px solid rgba(55,227,155,.42)",
                      background: "linear-gradient(180deg,rgba(55,227,155,.07),#0a0d0c 55%)",
                      boxShadow: "0 0 0 4px rgba(55,227,155,.06),0 30px 70px -34px rgba(55,227,155,.3)",
                    }
                  : {
                      border: "1px solid var(--ax-line)",
                      background: "#0a0d0c",
                    }),
              }}
            >
              {plan.highlighted && (
                <div
                  className="ax-mono"
                  style={{
                    position: "absolute",
                    right: 22,
                    top: -11,
                    font: `700 9px/1 ${mono}`,
                    letterSpacing: ".16em",
                    color: "#04150d",
                    background: "#37e39b",
                    borderRadius: 5,
                    padding: "6px 9px",
                  }}
                >
                  MOST TEAMS
                </div>
              )}
              <div>
                <div className="ax-mono" style={{ font: `600 10px/1 ${mono}`, letterSpacing: ".16em", color: plan.highlighted ? "#37e39b" : "#5b6b64" }}>
                  {plan.tag}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 18 }}>
                  <span style={{ font: "700 40px/1 var(--font-geist-sans)", letterSpacing: "-.04em" }}>{plan.price}</span>
                  {plan.period && <span className="ax-mono" style={{ font: `400 13px/1 ${mono}`, color: "#5b6b64" }}>{plan.period}</span>}
                </div>
                <p style={{ margin: "12px 0 0", minHeight: 40, font: "400 13px/1.55 var(--font-geist-sans)", color: "#8b9a93" }}>{plan.description}</p>
                <div style={{ height: 1, background: plan.highlighted ? "rgba(140,255,190,.14)" : "var(--ax-line)", margin: "22px 0" }} />
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 11, font: "400 13px/1.4 var(--font-geist-sans)", color: plan.highlighted ? "#c3cec8" : "#8b9a93" }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", gap: 9 }}>
                      <Check style={{ width: 15, height: 15, color: "#37e39b", flex: "none" }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => handlePlanClick(plan.name)}
                style={
                  plan.highlighted
                    ? { width: "100%", marginTop: "auto", paddingTop: 14, paddingBottom: 14, border: "none", borderRadius: 10, background: "#37e39b", color: "#04150d", font: "700 13px/1 var(--font-geist-sans)", cursor: "pointer" }
                    : { width: "100%", marginTop: "auto", paddingTop: 13, paddingBottom: 13, border: "1px solid rgba(140,255,190,.16)", borderRadius: 10, background: "#0f1312", color: "#e8edea", font: "600 13px/1 var(--font-geist-sans)", cursor: "pointer" }
                }
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .ax-price-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

import { Check } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for testing and small projects",
    features: [
      "1,000 validations/month",
      "Basic schema validation",
      "Community support",
      "7-day log retention",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For growing teams and production workloads",
    features: [
      "10,000 validations/month",
      "Semantic judge model",
      "Real-time alerts",
      "Priority support",
      "30-day log retention",
      "Custom schemas",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large-scale deployments with custom needs",
    features: [
      "Unlimited validations",
      "Custom judge models",
      "SLA guarantee",
      "Dedicated support",
      "Unlimited log retention",
      "On-premise deployment",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Start free and scale as you grow. No hidden fees.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative overflow-hidden rounded-2xl border p-8 transition-all ${
                plan.highlighted
                  ? "border-primary bg-card shadow-lg shadow-primary/10"
                  : "border-border bg-card/50 hover:border-border/80"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute right-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="mb-2 text-xl font-semibold text-foreground">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-3 text-sm text-muted-foreground"
                  >
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="#"
                className={`block w-full rounded-lg py-3 text-center text-sm font-medium transition-colors ${
                  plan.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

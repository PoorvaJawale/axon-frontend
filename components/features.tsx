import { Shield, Brain, Bell } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Schema Validation",
    description:
      "Define strict JSON schemas for your AI outputs. Catch malformed data before it corrupts your database or breaks your UI.",
  },
  {
    icon: Brain,
    title: "Semantic Judge Model",
    description:
      "Our AI judge evaluates outputs for correctness, safety, and alignment with your business rules. Goes beyond syntax to understand intent.",
  },
  {
    icon: Bell,
    title: "Real-time Alerts",
    description:
      "Get instant notifications when validation fails. Integrate with Slack, PagerDuty, or webhooks for immediate incident response.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Enterprise-grade validation
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Three layers of protection between your AI agents and production
            systems.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card/50 p-8 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-card"
            >
              {/* Glow effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="relative z-10">
                <div className="mb-6 inline-flex rounded-xl bg-primary/10 p-3">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-3 text-xl font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

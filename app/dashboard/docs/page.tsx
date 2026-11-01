import { IntegrationGuide } from "@/components/integration-guide";
export default function Docs() {
  return (
    <div className="dash-page">
      <header>
        <h1>Integration guide</h1>
        <p className="dash-muted">
          Choose who owns execution before connecting your agent.
        </p>
      </header>
      <IntegrationGuide />
    </div>
  );
}

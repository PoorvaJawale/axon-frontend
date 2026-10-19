"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { CircleCheck, CircleHelp, CircleAlert, RefreshCw } from "lucide-react";
import { STATUS_MAX_AGE_MS, STATUS_REFRESH_MS, unknownServices, type StatusSnapshot, type ServiceState } from "@/lib/service-status";

const labels: Record<ServiceState, string> = {
  operational: "Operational", degraded: "Slow response", unreachable: "Check failed", unknown: "Unknown",
};

async function fetchStatus(url: string): Promise<StatusSnapshot> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("Status unavailable");
  const data = await response.json();
  if (!data || !Number.isFinite(Date.parse(data.checkedAt)) || !Array.isArray(data.services) || data.services.length !== 3 ||
      !["website", "backend", "database"].every(id => data.services.some((service: { id?: string }) => service?.id === id)) ||
      !data.services.every((service: { state?: string; message?: string; name?: string; checkedAt?: string | null; latencyMs?: number | null }) =>
        service && Object.hasOwn(labels, service.state ?? "") && typeof service.message === "string" && typeof service.name === "string" &&
        (service.checkedAt === null || Number.isFinite(Date.parse(service.checkedAt ?? ""))) &&
        (service.latencyMs === null || (typeof service.latencyMs === "number" && Number.isFinite(service.latencyMs) && service.latencyMs >= 0)))) {
    throw new Error("Invalid status response");
  }
  return data;
}

function StateIcon({ state }: { state: ServiceState }) {
  const Icon = state === "operational" ? CircleCheck : state === "unknown" ? CircleHelp : CircleAlert;
  return <Icon size={16} aria-hidden="true" />;
}

export function ServiceHealth() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<StatusSnapshot>("/api/status", fetchStatus, {
    refreshInterval: STATUS_REFRESH_MS,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    revalidateOnFocus: true,
    dedupingInterval: 30_000,
    shouldRetryOnError: false,
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 15_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", update); document.removeEventListener("visibilitychange", update); };
  }, []);

  const stale = !!data && now - Date.parse(data.checkedAt) > STATUS_MAX_AGE_MS;
  const unavailable = !!error || stale;
  const services = !data || unavailable ? unknownServices() : data.services.map(service =>
    service.checkedAt && now - Date.parse(service.checkedAt) > STATUS_MAX_AGE_MS
      ? { ...service, state: "unknown" as const, message: "This check is out of date.", latencyMs: null }
      : service);
  const failed = services.some(service => service.state === "unreachable");
  const slow = services.some(service => service.state === "degraded");
  const allPassing = services.every(service => service.state === "operational");
  const overall: ServiceState = failed ? "unreachable" : slow ? "degraded" : allPassing ? "operational" : "unknown";
  const heading = isLoading ? "Checking service health" : unavailable ? "Service health unavailable" : failed ? "A service check failed" : slow ? "A service is responding slowly" : allPassing ? "All monitored checks are passing" : "Some checks are not connected";
  const description = unavailable ? "We couldn’t get recent results. Check again or contact the team if you’re having trouble." : "Checks refresh every minute while this page is open. These are point-in-time results, not continuous monitoring.";

  return <>
    <section className={"ap-snapshot ap-health-banner ap-health-" + overall} aria-labelledby="health-title">
      <StateIcon state={overall} />
      <div><h2 id="health-title" aria-live="polite">{heading}</h2><p>{description}</p></div>
      <button className="ap-action ap-check-button" type="button" disabled={isValidating} onClick={() => void mutate()}>
        <RefreshCw size={15} aria-hidden="true" />{isValidating ? "Checking…" : "Check now"}
      </button>
    </section>
    <section aria-labelledby="services-title">
      <div className="ap-section-heading"><h2 id="services-title">Service checks</h2><span className="ap-meta">{data && !unavailable ? <>Results received <time dateTime={data.checkedAt}>{new Date(data.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></> : "Awaiting recent results"}</span></div>
      <table className="ap-service-table ap-health-table">
        <caption>“Check failed” means a request failed or timed out; it does not confirm a sustained outage. Unknown means a check is unconfigured or recent results are unavailable.</caption>
        <thead><tr><th scope="col">Service</th><th scope="col">Latest result</th><th scope="col">Response</th></tr></thead>
        <tbody>{services.map(service => <tr key={service.id}>
          <th scope="row">{service.name}<span className="ap-check-detail">{unavailable ? "No recent check available." : service.message}</span></th>
          <td><span className={"ap-health-state ap-health-" + service.state}><StateIcon state={service.state} />{isLoading ? "Checking…" : labels[service.state]}</span></td>
          <td className="ap-check-latency">{service.latencyMs !== null && service.state !== "unknown" ? service.latencyMs.toLocaleString() + " ms" : "—"}</td>
        </tr>)}</tbody>
      </table>
      <p className="ap-health-scope">These checks cover the web application server, the n8n health workflow, and a database query. They do not test sign-in, schema validation, the semantic judge, or background validation. No OpenAI requests are made.</p>
    </section>
  </>;
}

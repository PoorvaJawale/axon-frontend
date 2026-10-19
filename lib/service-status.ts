export const STATUS_REFRESH_MS = 60_000;
export const STATUS_MAX_AGE_MS = 120_000;

export type ServiceState = "operational" | "degraded" | "unreachable" | "unknown";
export type ServiceCheck = {
  id: "website" | "backend" | "database";
  name: string;
  state: ServiceState;
  message: string;
  checkedAt: string | null;
  latencyMs: number | null;
};
export type StatusSnapshot = {
  checkedAt: string;
  services: ServiceCheck[];
};

export function unknownServices(): ServiceCheck[] {
  return [
    { id: "website", name: "Web app", state: "unknown", message: "No recent check available.", checkedAt: null, latencyMs: null },
    { id: "backend", name: "Backend workflow", state: "unknown", message: "Health endpoint is not configured.", checkedAt: null, latencyMs: null },
    { id: "database", name: "Database", state: "unknown", message: "Awaiting a backend database check.", checkedAt: null, latencyMs: null },
  ];
}

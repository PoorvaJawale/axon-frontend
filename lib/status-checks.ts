import "server-only";
import { randomUUID } from "node:crypto";
import { unknownServices, type ServiceCheck, type StatusSnapshot } from "@/lib/service-status";

const CACHE_MS = 30_000;
const TIMEOUT_MS = 5_000;
const SLOW_MS = 2_000;
const MAX_BODY_BYTES = 16_384;
type Environment = Record<string, string | undefined>;
type Dependencies = { env?: Environment; fetcher?: typeof fetch; now?: () => number; requestId?: () => string };

/** Only server configuration chooses destinations; callers cannot supply a URL or credentials. */
function configuredUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.hash || (url.protocol !== "https:" && !(local && url.protocol === "http:"))) return null;
    return url;
  } catch { return null; }
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
  } catch { return null; }
}

/** Per-instance cache plus request coalescing; the HTTP route also uses a shared CDN cache. */
export function createStatusChecker(dependencies: Dependencies = {}) {
  const env = dependencies.env ?? process.env;
  const fetcher = dependencies.fetcher ?? fetch;
  const now = dependencies.now ?? Date.now;
  const requestId = dependencies.requestId ?? randomUUID;
  let cached: StatusSnapshot | null = null;
  let expiresAt = 0;
  let pending: Promise<StatusSnapshot> | null = null;

  async function collect(): Promise<StatusSnapshot> {
    const services = unknownServices();
    const website = services[0];
    const backend = services[1];
    const database = services[2];
    const siteValue = env.AXON_PUBLIC_SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_URL ? "https://" + env.VERCEL_URL : undefined);
    const site = configuredUrl(siteValue);
    const health = configuredUrl(env.AXON_HEALTHCHECK_URL);
    const secret = env.AXON_HEALTHCHECK_SECRET;

    function result(check: ServiceCheck, state: ServiceCheck["state"], message: string, start: number) {
      Object.assign(check, { state, message, checkedAt: new Date(now()).toISOString(), latencyMs: Math.max(0, now() - start) });
    }
    function healthy(check: ServiceCheck, message: string, start: number) {
      const slow = now() - start > SLOW_MS;
      result(check, slow ? "degraded" : "operational", slow ? message + " Response was slower than 2 seconds." : message, start);
    }
    async function checkWebsite() {
      if (!site) return;
      const start = now();
      try {
        const id = requestId();
        const response = await fetcher(new URL("/api/health", site), {
          headers: { "x-axon-health-request-id": id }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const data = await readJson(response);
        if (response.ok && data?.service === "axon-web" && data.status === "ok" && data.request_id === id) {
          healthy(website, "Web application server responded.", start);
        } else if ([401, 403, 404].includes(response.status) || response.ok) {
          result(website, "unknown", "Web health endpoint could not be verified.", start);
        } else { result(website, "unreachable", "Web health check failed.", start); }
      } catch { result(website, "unreachable", "Web health check did not complete within 5 seconds or could not connect.", start); }
    }
    async function checkBackend() {
      if (!health || !secret) return;
      const start = now();
      try {
        const id = requestId();
        const response = await fetcher(health, {
          headers: { "x-axon-health-secret": secret, "x-axon-health-request-id": id },
          cache: "no-store", redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const data = await readJson(response);
        // A nonce confirms this workflow processed this check, rather than returning a cached body.
        const valid = data?.service === "axon-health" && data.request_id === id && ["ok", "error"].includes(String(data.database));
        if (valid && ((response.ok && data.database === "ok") || (response.status === 503 && data.database === "error"))) {
          healthy(backend, "Health workflow responded. Agent validation is not tested.", start);
          result(database, data.database === "ok" ? "operational" : "unreachable", data.database === "ok" ? "Database test query succeeded." : "Database test query failed.", start);
          database.latencyMs = null; // The workflow round trip is not an isolated database query duration.
        } else if ([401, 403, 404].includes(response.status) || response.ok || valid) {
          result(backend, "unknown", "Health endpoint configuration could not be verified.", start);
        } else { result(backend, "unreachable", "Backend health check failed.", start); }
      } catch { result(backend, "unreachable", "Backend health check did not complete within 5 seconds or could not connect.", start); }
    }
    await Promise.allSettled([checkWebsite(), checkBackend()]);
    return { checkedAt: new Date(now()).toISOString(), services };
  }
  return async function getStatus(): Promise<StatusSnapshot> {
    if (cached && now() < expiresAt) return cached;
    if (!pending) {
      pending = collect().then(snapshot => { cached = snapshot; expiresAt = now() + CACHE_MS; return snapshot; }).finally(() => { pending = null; });
    }
    return pending;
  };
}

export const getServiceStatus = createStatusChecker();

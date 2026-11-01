/* eslint-disable @typescript-eslint/no-require-imports -- Node operator/development entrypoint. */
// Independent, read-only monitoring: runs even if the website or primary DB fails.
const { randomUUID } = require("node:crypto");
async function publishedStatus(url) {
  if (!url) return ["unknown", "unknown"];
  try {
    const target = new URL(url);
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.hash
    )
      throw Error();
    const response = await fetch(target, {
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: { "Cache-Control": "no-cache" },
    });
    let text = "",
      size = 0;
    for await (const chunk of response.body) {
      size += chunk.byteLength;
      if (size > 16384) throw Error();
      text += Buffer.from(chunk).toString("utf8");
    }
    const body = JSON.parse(text);
    const recent = (value) =>
      Number.isFinite(Date.parse(value)) &&
      Date.now() - Date.parse(value) <= 120000 &&
      Date.parse(value) <= Date.now() + 10000;
    if (
      !response.ok ||
      !recent(body.checkedAt) ||
      !Array.isArray(body.services)
    )
      throw Error();
    return ["backend", "database"].map((id) => {
      const matches = body.services.filter((service) => service.id === id);
      if (matches.length !== 1 || !recent(matches[0].checkedAt))
        return "unknown";
      return ["operational", "degraded", "unreachable", "unknown"].includes(
        matches[0].state,
      )
        ? matches[0].state
        : "unknown";
    });
  } catch {
    return ["unknown", "unknown"];
  }
}
async function check(url, secret, backend) {
  if (!url || (backend && !secret)) return ["unknown"];
  try {
    const target = new URL(url);
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.hash
    )
      throw Error();
    const id = randomUUID();
    const r = await fetch(target, {
      headers: {
        "x-axon-health-request-id": id,
        ...(backend ? { "x-axon-health-secret": secret } : {}),
      },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    let size = 0,
      text = "";
    for await (const chunk of r.body) {
      size += chunk.byteLength;
      if (size > 16384) throw Error();
      text += Buffer.from(chunk).toString("utf8");
    }
    const body = JSON.parse(text);
    if (body.request_id !== id) return ["unknown"];
    if (!backend)
      return [
        r.ok && body.service === "axon-web" && body.status === "ok"
          ? "operational"
          : "unreachable",
      ];
    if (body.service !== "axon-health") return ["unknown", "unknown"];
    if (r.ok && body.database === "ok") return ["operational", "operational"];
    if (r.status === 503 && body.database === "error")
      return ["operational", "unreachable"];
    return ["unknown", "unknown"];
  } catch {
    return backend ? ["unreachable", "unknown"] : ["unreachable"];
  }
}
(async () => {
  const [web, backend] = await Promise.all([
    check(process.env.AXON_MONITOR_WEB_URL, null, false),
    process.env.AXON_MONITOR_STATUS_URL
      ? publishedStatus(process.env.AXON_MONITOR_STATUS_URL)
      : check(
          process.env.AXON_MONITOR_BACKEND_URL,
          process.env.AXON_HEALTHCHECK_SECRET,
          true,
        ),
  ]);
  const states = {
    web: web[0],
    backend: backend[0],
    database: backend[1] || "unknown",
  };
  for (const [name, state] of Object.entries(states))
    console.log(name + ": " + state);
  if (Object.values(states).some((s) => s !== "operational"))
    process.exitCode = 1;
})();

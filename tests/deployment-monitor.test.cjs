/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
async function fixture(mode) {
  const lines = [],
    state = {};
  let calls = 0;
  const env =
    mode === "missing"
      ? {}
      : {
          AXON_MONITOR_WEB_URL: "https://web.example/api/health",
          AXON_MONITOR_BACKEND_URL: "https://backend.example/health",
          AXON_HEALTHCHECK_SECRET: "fixture",
          ...(mode.startsWith("public-")
            ? { AXON_MONITOR_STATUS_URL: "https://web.example/api/status" }
            : {}),
        };
  await vm.runInNewContext(
    fs.readFileSync("scripts/check-deployment.cjs", "utf8"),
    {
      URL,
      Buffer,
      AbortSignal,
      process: {
        env,
        set exitCode(n) {
          state.exitCode = n;
        },
      },
      require: () => ({ randomUUID: () => "nonce" }),
      console: { log: (s) => lines.push(s) },
      fetch: async (url) => {
        calls++;
        if (url.pathname === "/api/status") {
          const now = new Date(
            Date.now() - (mode === "public-stale" ? 180000 : 0),
          ).toISOString();
          return Response.json({
            checkedAt: now,
            services: [
              { id: "backend", state: "operational", checkedAt: now },
              {
                id: "database",
                state:
                  mode === "public-db-down" ? "unreachable" : "operational",
                checkedAt: now,
              },
            ],
          });
        }
        if (mode === "web-down" && url.hostname === "web.example")
          throw Error();
        const backend = url.hostname === "backend.example";
        return new Response(
          JSON.stringify(
            backend
              ? {
                  service: "axon-health",
                  request_id: mode === "stale" ? "old" : "nonce",
                  database: mode === "db-down" ? "error" : "ok",
                }
              : { service: "axon-web", request_id: "nonce", status: "ok" },
          ),
          { status: backend && mode === "db-down" ? 503 : 200 },
        );
      },
    },
  );
  return { lines, state, calls };
}
test("independent monitoring detects database failure while acknowledging running servers", async () => {
  const r = await fixture("db-down");
  assert.deepEqual(r.lines, [
    "web: operational",
    "backend: operational",
    "database: unreachable",
  ]);
  assert.equal(r.state.exitCode, 1);
});

test("credential-free public status monitoring detects outages and rejects stale green snapshots", async () => {
  const healthy = await fixture("public-healthy");
  assert.deepEqual(healthy.lines, [
    "web: operational",
    "backend: operational",
    "database: operational",
  ]);
  const failed = await fixture("public-db-down");
  assert(failed.lines.includes("database: unreachable"));
  assert.equal(failed.state.exitCode, 1);
  const stale = await fixture("public-stale");
  assert(stale.lines.includes("database: unknown"));
  assert.equal(stale.state.exitCode, 1);
});
test("independent monitoring still checks backend when the website is unavailable", async () => {
  const r = await fixture("web-down");
  assert.deepEqual(r.lines, [
    "web: unreachable",
    "backend: operational",
    "database: operational",
  ]);
});
test("missing configuration and stale responses never report a false green", async () => {
  const absent = await fixture("missing");
  assert.equal(absent.calls, 0);
  assert.equal(absent.state.exitCode, 1);
  const stale = await fixture("stale");
  assert(stale.lines.includes("database: unknown"));
  assert.equal(stale.state.exitCode, 1);
});

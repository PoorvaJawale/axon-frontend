/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  { decide } = require("../backend/operations/health-alert.cjs");
const ok = {
    web: "operational",
    backend: "operational",
    database: "operational",
  },
  down = { ...ok, database: "unreachable" };
test("health alerts are quiet when initially healthy and when failure state is unchanged", () => {
  assert.equal(decide(null, ok).notify, false);
  const d = decide(null, down);
  assert.equal(d.notify, true);
  assert.equal(decide(d, down).notify, false);
});
test("health alerts notify on failure changes and once when checks recover", () => {
  const d = decide(null, down);
  const r = decide(d, ok);
  assert.equal(r.notify, true);
  assert.equal(r.event, "recovered");
  assert.equal(decide(r, ok).notify, false);
  assert.equal(decide(d, { ...down, web: "unreachable" }).notify, true);
});
test("unknown state requires attention without being relabeled as confirmed downtime", () => {
  const d = decide(null, { ...ok, backend: "unknown", database: "unknown" });
  assert.equal(d.notify, true);
  assert.equal(d.healthy, false);
  assert.throws(() => decide(null, { ...ok, database: "healthy" }));
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
async function fixture(options = {}) {
  const lines = [],
    errors = [],
    state = { calls: 0 };
  const env = options.empty
    ? {}
    : {
        VERCEL_ENV: "production",
        RAZORPAY_KEY_ID: options.testMode
          ? "rzp_test_fixture"
          : "rzp_live_fixture",
        RAZORPAY_KEY_SECRET: "NEVER_PRINT_THIS_PROVIDER_SECRET",
        RAZORPAY_PLAN_ID: "plan_fixture",
      };
  await vm.runInNewContext(
    fs.readFileSync("scripts/provider-preflight.cjs", "utf8"),
    {
      process: {
        env,
        set exitCode(code) {
          state.exitCode = code;
        },
      },
      Buffer,
      AbortSignal,
      console: {
        log: (s) => lines.push(s),
        error: (...s) => errors.push(s.join(" ")),
      },
      fetch: async (url, settings) => {
        state.calls++;
        assert.equal(url, "https://api.razorpay.com/v1/plans/plan_fixture");
        assert.equal(settings.redirect, "error");
        return Response.json(
          {
            period: "monthly",
            interval: 1,
            item: {
              currency: "INR",
              amount: options.wrongPrice ? 299900 : 79900,
            },
          },
          { status: options.providerFailure ? 503 : 200 },
        );
      },
    },
  );
  assert(
    !JSON.stringify([...lines, ...errors]).includes(
      "NEVER_PRINT_THIS_PROVIDER_SECRET",
    ),
  );
  return { lines, errors, state };
}
test("deployment payment preflight validates live monthly INR 799 pricing without mutating provider state or logging secrets", async () => {
  const good = await fixture();
  assert.equal(good.state.calls, 1);
  assert.equal(good.state.exitCode, undefined);
  assert(good.lines.some((s) => s.includes('"amountPaise":79900')));
  const bad = await fixture({ wrongPrice: true });
  assert.equal(bad.state.exitCode, 1);
  assert(
    bad.errors.some((s) =>
      s.includes("PAYMENT_PLAN_MUST_BE_MONTHLY_INR_79900"),
    ),
  );
  const failed = await fixture({ providerFailure: true });
  assert.equal(failed.state.exitCode, 1);
  assert(failed.errors.some((s) => s.includes("PAYMENT_PLAN_LOOKUP_FAILED")));
});
test("deployment payment preflight skips unconfigured CI and rejects test credentials in a Production deployment", async () => {
  const empty = await fixture({ empty: true });
  assert.equal(empty.state.calls, 0);
  assert.equal(empty.state.exitCode, undefined);
  const testMode = await fixture({ testMode: true });
  assert.equal(testMode.state.calls, 0);
  assert.equal(testMode.state.exitCode, 1);
});

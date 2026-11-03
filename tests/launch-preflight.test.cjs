/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
function check(overrides = {}, launch = true) {
  const state = {},
    lines = [];
  vm.runInNewContext(fs.readFileSync("scripts/preflight.cjs", "utf8"), {
    URL,
    process: {
      argv: launch ? ["node", "script", "--public-launch"] : ["node", "script"],
      env: {
        AXON_DATABASE_URL:
          "postgres://fixture@db.example/fixture?sslmode=verify-full",
        AXON_PUBLIC_SITE_URL: "https://axon.example",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_placeholder",
        CLERK_SECRET_KEY: "sk_live_placeholder",
        RAZORPAY_KEY_ID: "rzp_live_placeholder",
        RAZORPAY_KEY_SECRET: "placeholder",
        RAZORPAY_PLAN_ID: "placeholder",
        RAZORPAY_WEBHOOK_SECRET: "placeholder",
        ...overrides,
      },
      set exitCode(x) {
        state.code = x;
      },
    },
    console: { log: (x) => lines.push(x), error: (x) => lines.push(x) },
    require: () => ({ existsSync: () => true }),
  });
  return { ...state, lines };
}
test("public launch preflight rejects development identity, unowned-host setup and mismatched key modes without revealing values", () => {
  assert.equal(check().code, 0);
  for (const patch of [
    {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_private",
      CLERK_SECRET_KEY: "sk_test_private",
    },
    { CLERK_SECRET_KEY: "sk_test_private" },
    { AXON_PUBLIC_SITE_URL: "https://axon-frontend-vxa8.vercel.app" },
    { AXON_PUBLIC_SITE_URL: "http://localhost:3101" },
    { RAZORPAY_KEY_ID: "rzp_test_private" },
  ]) {
    const r = check(patch);
    assert.equal(r.code, 1);
    assert.ok(!r.lines.join(" ").includes("private"));
  }
  assert.equal(
    check(
      {
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_placeholder",
        CLERK_SECRET_KEY: "sk_test_placeholder",
      },
      false,
    ).code,
    0,
  );
});

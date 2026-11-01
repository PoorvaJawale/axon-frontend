/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function load(overrides = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("lib/security/http.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      URL,
      Set,
      process: {
        env: {
          NODE_ENV: "production",
          AXON_PUBLIC_SITE_URL: "https://axon-frontend-vxa8.vercel.app",
          VERCEL: "1",
          VERCEL_URL: "axon-frontend-vxa8-release-owner.vercel.app",
          ...overrides,
        },
      },
      require: () => ({ NextResponse: {} }),
    },
  );
  return exports.assertSameOrigin;
}
function request(
  origin,
  extra = {},
  url = "https://attacker.example/webhook/create-api-key",
) {
  return new Request(url, {
    method: "POST",
    headers: { ...(origin ? { origin } : {}), ...extra },
  });
}
test("browser mutations permit the canonical site and exact trusted deployment while rejecting foreign or forged origins", () => {
  const check = load();
  check(request("https://axon-frontend-vxa8.vercel.app"));
  check(request("https://axon-frontend-vxa8-release-owner.vercel.app"));
  for (const origin of [
    "https://attacker.vercel.app",
    "https://axon-frontend-vxa8-release-owner.vercel.app.attacker.example",
    "http://axon-frontend-vxa8-release-owner.vercel.app",
    "https://attacker.example",
    "null",
  ])
    assert.throws(
      () => check(request(origin)),
      (e) => e.code === "ORIGIN_REJECTED",
    );
  assert.throws(
    () =>
      check(
        request("https://attacker.example", {
          host: "attacker.example",
          "x-forwarded-host": "attacker.example",
        }),
      ),
    (e) => e.code === "ORIGIN_REJECTED",
  );
  assert.throws(
    () =>
      check(
        request("https://axon-frontend-vxa8-release-owner.vercel.app", {
          "sec-fetch-site": "cross-site",
        }),
      ),
    (e) => e.code === "ORIGIN_REJECTED",
  );
  assert.throws(
    () => check(request()),
    (e) => e.code === "ORIGIN_REQUIRED",
  );
});
test("deployment origin requires Vercel system context and a valid hostname", () => {
  for (const settings of [
    { VERCEL: undefined },
    { VERCEL_URL: "attacker.example" },
    {
      VERCEL_URL:
        "attacker.example@axon-frontend-vxa8-release-owner.vercel.app",
    },
    { VERCEL_URL: "axon-frontend-vxa8-release-owner.vercel.app/path" },
  ]) {
    const check = load(settings);
    check(request("https://axon-frontend-vxa8.vercel.app"));
    assert.throws(
      () =>
        check(request("https://axon-frontend-vxa8-release-owner.vercel.app")),
      (e) => e.code === "ORIGIN_REJECTED",
    );
  }
});

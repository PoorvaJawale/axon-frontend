/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  vm = require("vm"),
  ts = require("typescript");
function origins(env) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("lib/security/auth-origins.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    { exports, URL, Set, process: { env: {} } },
  );
  return Array.from(exports.authorizedOrigins(env));
}
test("Clerk tokens allow only the configured canonical and exact trusted deployment origins in production", () => {
  const base = {
    NODE_ENV: "production",
    AXON_PUBLIC_SITE_URL: "https://axon.example",
    VERCEL: "1",
    VERCEL_URL: "axon-release-owner.vercel.app",
  };
  assert.deepEqual(origins(base), [
    "https://axon.example",
    "https://axon-release-owner.vercel.app",
  ]);
  for (const host of [
    "attacker.example",
    "user@axon-release-owner.vercel.app",
    "axon-release-owner.vercel.app/path",
  ])
    assert.deepEqual(origins({ ...base, VERCEL_URL: host }), [
      "https://axon.example",
    ]);
  assert.deepEqual(origins({ ...base, VERCEL: undefined }), [
    "https://axon.example",
  ]);
});
test("local browser origins are development-only and malformed canonical configuration fails closed", () => {
  assert(
    origins({ NODE_ENV: "development" }).includes("http://localhost:3101"),
  );
  assert(
    !origins({ NODE_ENV: "production" }).some((x) => x.includes("localhost")),
  );
  for (const url of [
    "http://axon.example",
    "https://user:pass@axon.example",
    "https://axon.example/path",
    "https://axon.example/?token=x",
  ])
    assert.throws(() =>
      origins({ NODE_ENV: "production", AXON_PUBLIC_SITE_URL: url }),
    );
});

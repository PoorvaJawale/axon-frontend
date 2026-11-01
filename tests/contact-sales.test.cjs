/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const ts = require("typescript");
function fixture() {
  const sent = [],
    cache = {};
  function load(file) {
    if (cache[file]) return cache[file];
    const exports = {};
    cache[file] = exports;
    vm.runInNewContext(
      ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText,
      {
        exports,
        Buffer,
        URL,
        TextDecoder,
        setTimeout,
        clearTimeout,
        console: { error: () => {} },
        process: {
          env: {
            NODE_ENV: "production",
            AXON_PUBLIC_SITE_URL: "https://axon.example",
            GMAIL_USER: "fixture@example.com",
            GMAIL_APP_PASSWORD: "fixture",
          },
        },
        require: (n) => {
          if (n === "next/server")
            return {
              NextResponse: {
                json: (body, opts) => ({ body, status: opts?.status || 200 }),
              },
            };
          if (n === "nodemailer")
            return {
              createTransport: () => ({
                sendMail: async (data) => sent.push(data),
              }),
            };
          if (n === "@/lib/security/rate-limit")
            return { limitRequest: async () => {} };
          if (n.startsWith("@/")) return load(n.slice(2) + ".ts");
          return require(n);
        },
      },
    );
    return exports;
  }
  return {
    sent,
    readText: load("lib/security/http.ts").readText,
    post: (body, origin = "https://axon.example") =>
      load("app/webhook/contact-sales/route.ts").POST(
        new Request("https://axon.example/webhook/contact-sales", {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
  };
}
test("both shipped enterprise contact forms work and invalid input never sends mail", async () => {
  const f = fixture(),
    base = {
      fullName: "Test Owner",
      companyName: "Example",
      workEmail: "test@example.com",
      systems: [],
      onPremise: false,
    };
  assert.equal(
    (
      await f.post({
        ...base,
        agentsCount: "1-10",
        monthlyVolume: "5000",
        useCase: "Support",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await f.post({
        ...base,
        agentVolume: "1-10",
        validationEstimate: "5000",
        useCase: "",
      })
    ).status,
    200,
  );
  assert.equal(f.sent.length, 2);
  assert.equal(
    (
      await f.post({
        ...base,
        agentsCount: "1",
        monthlyVolume: "5000",
        workEmail: "bad\r\nBcc: attacker@example.com",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.post({
        ...base,
        agentsCount: "1",
        monthlyVolume: "5000",
        unknown: "data",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.post(
        { ...base, agentsCount: "1", monthlyVolume: "5000" },
        "https://evil.example",
      )
    ).status,
    403,
  );
  assert.equal(f.sent.length, 2);
});

test("a stalled request body is cancelled instead of holding the handler indefinitely", async () => {
  const f = fixture();
  let cancelled = false;
  const body = new ReadableStream({
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    () => f.readText({ headers: new Headers(), body }),
    (error) => error.status === 408,
  );
  assert.equal(cancelled, true);
});

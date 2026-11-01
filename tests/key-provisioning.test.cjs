/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
function fixture() {
  const cache = {};
  let inserts = 0;
  const metadata = [];
  const db = {
    async query(sql) {
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
      if (sql.includes("privacy_requests")) return { rows: [] };
      if (sql.startsWith("SELECT key_prefix"))
        return { rows: [{ key_prefix: "existing-prefix" }] };
      if (sql.startsWith("INSERT")) inserts++;
      throw Error("Unexpected provisioning query");
    },
  };
  function load(file) {
    if (cache[file]) return cache[file];
    const exports = {};
    cache[file] = exports;
    vm.runInNewContext(
      ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      {
        exports,
        Request,
        Response,
        URL,
        TextDecoder,
        setTimeout,
        clearTimeout,
        console: { error() {} },
        process: {
          env: {
            NODE_ENV: "production",
            AXON_PUBLIC_SITE_URL: "https://axon.example",
          },
        },
        require(name) {
          if (name === "@/lib/account")
            return {
              accountRoute: async (request, run) => {
                const http = load("lib/security/http.ts");
                try {
                  http.assertSameOrigin(request);
                  return http.privateJson(await run("owner"));
                } catch (e) {
                  return http.failure(e);
                }
              },
            };
          if (name === "@/lib/db") return { transaction: (run) => run(db) };
          if (name === "@clerk/nextjs/server")
            return {
              clerkClient: async () => ({
                users: {
                  getUser: async () => ({
                    primaryEmailAddress: {
                      emailAddress: "owner@example.com",
                      verification: { status: "verified" },
                    },
                  }),
                  updateUserMetadata: async (id, data) =>
                    metadata.push({ id, data }),
                },
              }),
            };
          if (name === "next/server")
            return {
              NextResponse: {
                json: (data, options) => Response.json(data, options),
              },
            };
          if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
          return require(name);
        },
      },
    );
    return exports;
  }
  return {
    post: load("app/webhook/create-api-key/route.ts").POST,
    inserts: () => inserts,
    metadata,
  };
}
function request(body, type) {
  return new Request("https://axon.example/webhook/create-api-key", {
    method: "POST",
    headers: {
      origin: "https://axon.example",
      ...(type ? { "content-type": type } : {}),
    },
    ...(body === undefined ? {} : { body, duplex: "half" }),
  });
}
test("default key setup accepts JSON and bodyless or proxy-empty POSTs without duplicating an existing key", async () => {
  const f = fixture();
  const emptyStream = new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
  for (const r of [
    request(),
    request(emptyStream),
    request("{}", "application/json"),
  ]) {
    const response = await f.post(r);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      alreadyProvisioned: true,
      keyPrefix: "existing-prefix",
    });
  }
  assert.equal(f.inserts(), 0);
  assert.equal(f.metadata.length, 3);
  for (const update of f.metadata)
    assert.equal(update.data.privateMetadata.axonApiKey, null);
});
test("key setup still rejects non-JSON and malformed JSON bodies without creating keys", async () => {
  const f = fixture();
  const noType = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("{}"));
      controller.close();
    },
  });
  for (const [r, status, code] of [
    [request(noType), 415, "JSON_REQUIRED"],
    [request("{}", "text/plain"), 415, "JSON_REQUIRED"],
    [request("{", "application/json"), 400, "INVALID_JSON"],
  ]) {
    const response = await f.post(r);
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
  }
  assert.equal(f.inserts(), 0);
  assert.equal(f.metadata.length, 0);
});

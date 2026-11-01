/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
test("account endpoints isolate two tenants, survive absent API keys, and reject invalid mutations", async () => {
  const db = new PGlite();
  let userId = "a";
  const cache = {};
  await db.exec(
    "CREATE TABLE api_keys(id bigserial PRIMARY KEY,user_id text,name text,key_prefix text,plan text,is_active boolean,created_at timestamptz DEFAULT now(),updated_at timestamptz,last_used_at timestamptz,expires_at timestamptz DEFAULT now()+interval '1 day',monthly_requests bigint DEFAULT 0);CREATE TABLE axon_account_quota(user_id text PRIMARY KEY,plan text,free_used bigint,paid_used bigint,custom_limit bigint,period_start timestamptz,period_end timestamptz);CREATE TABLE validation_logs(id bigserial PRIMARY KEY,user_id text,timestamp timestamptz DEFAULT now(),agent_id text,action_type text,final_verdict text,reason text,raw_output jsonb,schema_result text,risk_level text,category text);",
  );
  await db.exec(
    fs.readFileSync("backend/migrations/001_control_security.sql", "utf8"),
  );
  await db.exec(
    "INSERT INTO axon_account_quota VALUES('a','free',44,0,0,NULL,NULL),('b','pro',12,333,0,now()-interval '1 day',now()+interval '29 days');INSERT INTO api_keys(user_id,name,key_prefix,plan,is_active) VALUES('a','A','prefix-a','free',true),('b','B','prefix-b','pro',true);INSERT INTO validation_logs(user_id,agent_id,action_type,final_verdict,reason) VALUES('a','agent-a','email_send','BLOCK','A only'),('b','agent-b','payment','BLOCK','B only');",
  );
  const database = {
    query: async (sql, values) => (await db.query(sql, values)).rows,
    transaction: async (run) => {
      await db.exec("BEGIN");
      try {
        const out = await run({ query: (sql, v) => db.query(sql, v) });
        await db.exec("COMMIT");
        return out;
      } catch (e) {
        await db.exec("ROLLBACK");
        throw e;
      }
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
        Buffer,
        Request,
        Response,
        URL,
        TextDecoder,
        setTimeout,
        clearTimeout,
        setTimeout,
        clearTimeout,
        console: { error: () => {} },
        process: {
          env: {
            NODE_ENV: "production",
            AXON_PUBLIC_SITE_URL: "https://axon.example",
          },
        },
        require: (n) => {
          if (n === "server-only") return {};
          if (n === "@/lib/db") return database;
          if (n === "@clerk/nextjs/server")
            return { auth: async () => ({ userId }) };
          if (n === "next/server")
            return {
              NextResponse: {
                json: (body, opts) => ({
                  body,
                  status: opts?.status || 200,
                  headers: opts?.headers,
                }),
              },
            };
          if (n.startsWith("@/")) return load(n.slice(2) + ".ts");
          return require(n);
        },
      },
    );
    return exports;
  }
  const get = (route, query = "") =>
    load("app/webhook/" + route + "/route.ts").GET(
      new Request("https://axon.example/webhook/" + route + query),
    );
  const post = (route, body, origin = "https://axon.example") =>
    load("app/webhook/" + route + "/route.ts").POST(
      new Request("https://axon.example/webhook/" + route, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  try {
    assert.equal((await get("usage")).body.monthly_requests, 44);
    assert.equal(
      (await get("usage")).headers["Cache-Control"],
      "private, no-store",
    );
    const keys = await get("api-keys", "?user_id=b");
    assert.equal(keys.body.keys.length, 1);
    assert.equal(keys.body.keys[0].name, "A");
    assert.equal((await post("revoke-key", { keyId: 2 })).status, 404);
    assert.equal(
      (await post("alerts", { alertId: 2, reviewed: true })).status,
      404,
    );
    assert.equal(
      (await post("alerts", { alertId: 1, reviewed: true })).body.success,
      true,
    );
    assert.equal(
      (await get("alerts", "?filter=Reviewed")).body.alerts.length,
      1,
    );
    assert.equal(
      (
        await post(
          "alerts",
          { alertId: 1, reviewed: false },
          "https://evil.example",
        )
      ).status,
      403,
    );
    for (const keyId of [true, 0, -1, "1e2", "1 OR 1=1", null])
      assert.equal((await post("revoke-key", { keyId })).status, 400);
    assert.equal((await get("logs", "?limit=-1")).status, 400);
    assert.equal((await get("logs", "?limit=10000")).status, 400);
    const logs = await get("logs");
    assert.equal(logs.body.logs.length, 1);
    assert.equal(logs.body.logs[0].reason, "A only");
    assert.equal((await post("revoke-key", { keyId: 1 })).body.success, true);
    // Dashboard usage still works after every customer key is revoked.
    assert.equal((await get("usage")).status, 200);
    await db.exec(
      "INSERT INTO validation_logs(user_id,agent_id,action_type,final_verdict,reason,timestamp) SELECT 'a','agent-a','email_send','PASS','Page test',now()-CASE WHEN g<=200 THEN interval '1 hour' ELSE interval '2 days' END FROM generate_series(1,250) g",
    );
    const recent = await get("logs", "?hours=24&limit=100&page=3");
    assert.equal(recent.body.pagination.totalCount, 201);
    assert.equal(recent.body.logs.length, 1);
    assert.equal(recent.body.stats.total, 201);
    assert.equal(recent.body.stats.passed, 200);
    assert.equal(
      (await get("logs", "?search=agent-a")).body.pagination.totalCount,
      251,
    );
    userId = "b";
    assert.equal((await get("usage")).body.plan, "pro");
    assert.equal((await get("usage")).body.monthly_requests, 333);
    assert.equal(
      (await get("alerts", "?filter=Reviewed")).body.alerts.length,
      0,
    );
    userId = null;
    assert.equal((await get("api-keys")).status, 401);
  } finally {
    await db.close();
  }
});

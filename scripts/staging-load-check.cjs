/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  { spawnSync } = require("node:child_process"),
  { Client } = require("pg");
const root = path.resolve(__dirname, ".."),
  container = "axon-local-staging-n8n-1",
  ids = ["axonMockValidate", "axonMockWorker", "axonMockStatus"],
  prefix = "load_test_" + crypto.randomUUID();
const values = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".cache/staging/.env"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((x) => x.split("=")),
);
const db = new Client({
  host: "127.0.0.1",
  port: 55432,
  database: "axon_staging",
  user: "axon_staging_admin",
  password: values.STAGING_DB_PASSWORD,
  connectionTimeoutMillis: 10000,
  statement_timeout: 10000,
});
function docker(args) {
  const r = spawnSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 120000,
  });
  if (r.status !== 0)
    throw Error("Local load-test setup/cleanup failed; raw output withheld");
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function main() {
  try {
    for (const id of ids)
      docker(["exec", container, "n8n", "publish:workflow", "--id=" + id]);
    docker(["restart", container]);
    // The general health endpoint can respond before published webhooks load.
    // Wait for the actual guard to reject an empty request before applying load.
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(
          "http://localhost:5688/webhook/axon-local-mock-validate",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            signal: AbortSignal.timeout(2000),
          },
        );
        if (r.status === 400) {
          ready = true;
          break;
        }
      } catch {}
      await pause(500);
    }
    assert(ready, "Local validation webhook not ready");
    await db.connect();
    const tenants = [];
    for (let i = 0; i < 3; i++) {
      const user = prefix + "_" + i,
        key = "sk-axon-" + crypto.randomBytes(24).toString("hex");
      tenants.push({ user, key });
      await db.query(
        "INSERT INTO public.axon_account_quota(user_id,plan,free_used,paid_used,custom_limit) VALUES($1,'free',0,0,0)",
        [user],
      );
      await db.query(
        "INSERT INTO public.api_keys(user_id,name,key_prefix,hashed_api_key,webhook_secret,plan,request_limit,is_active,expires_at) VALUES($1,'Local load probe',$2,$3,'synthetic','free',100,true,now()+interval '1 hour')",
        [
          user,
          key.slice(0, 20),
          crypto.createHash("sha256").update(key).digest("hex"),
        ],
      );
    }
    const results = [],
      started = Date.now();
    let next = 0;
    async function post(tenant, id) {
      const start = Date.now(),
        r = await fetch(
          "http://localhost:5688/webhook/axon-local-mock-validate",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + tenant.key,
              "Idempotency-Key": id,
            },
            body: JSON.stringify({
              agent_id: "load-probe",
              action_type: "api_call",
              mode: "validate_only",
              content: {
                mockVerdict: "PASS",
                syntheticPayload: "x".repeat(8000),
              },
            }),
            signal: AbortSignal.timeout(30000),
          },
        );
      return {
        status: r.status,
        ms: Date.now() - start,
        tenant: tenant.user,
        id,
      };
    }
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (next < 60) {
          const i = next++;
          results.push(await post(tenants[i % 3], crypto.randomUUID()));
        }
      }),
    );
    fs.writeFileSync(
      path.join(root, ".cache/staging/load-http-results.json"),
      JSON.stringify(
        {
          statuses: results.reduce(
            (counts, r) => ({
              ...counts,
              [r.status]: (counts[r.status] || 0) + 1,
            }),
            {},
          ),
          results,
        },
        null,
        2,
      ) + "\n",
    );
    assert(
      results.every((x) => [200, 429].includes(x.status)),
      "Unexpected burst HTTP statuses: " +
        JSON.stringify(
          results.reduce(
            (counts, r) => ({
              ...counts,
              [r.status]: (counts[r.status] || 0) + 1,
            }),
            {},
          ),
        ),
    );
    const accepted = results.filter((x) => x.status === 200);
    assert(accepted.length > 0, "No admitted requests");
    const retries = accepted.slice(0, 5);
    for (const r of retries)
      assert.equal(
        (
          await post(
            tenants.find((t) => t.user === r.tenant),
            r.id,
          )
        ).status,
        409,
      );
    let counted = 0;
    for (const t of tenants) {
      const row = (
        await db.query(
          "SELECT free_used FROM public.axon_account_quota WHERE user_id=$1",
          [t.user],
        )
      ).rows[0];
      const expected = accepted.filter((r) => r.tenant === t.user).length;
      assert.equal(Number(row.free_used), expected);
      counted += Number(row.free_used);
    }
    const sorted = results.map((x) => x.ms).sort((a, b) => a - b),
      percentile = (p) => sorted[Math.ceil(sorted.length * p) - 1];
    const report = {
      at: new Date().toISOString(),
      runtime: "n8n/runner 2.45.7",
      synthetic: true,
      model: "canned response; no OpenAI calls",
      tenants: 3,
      requests: 60,
      concurrency: 8,
      payloadBytes: 8000,
      accepted: accepted.length,
      rateLimited: results.length - accepted.length,
      retryChecks: retries.length,
      countedVerdicts: counted,
      durationMs: Date.now() - started,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      limitation:
        "Local short burst with simulated model; not sustained cloud or provider capacity",
    };
    fs.writeFileSync(
      path.join(root, ".cache/staging/load-result.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } finally {
    for (const id of ids)
      docker(["exec", container, "n8n", "unpublish:workflow", "--id=" + id]);
    docker(["restart", container]);
    if (db._connected)
      for (const table of [
        "axon_security.validation_inflight",
        "axon_security.validation_jobs",
        "public.validation_logs",
        "public.axon_quota_reservation",
        "public.api_keys",
        "public.axon_account_quota",
      ])
        await db.query(
          "DELETE FROM " + table + " WHERE user_id = ANY($1::text[])",
          [[0, 1, 2].map((i) => prefix + "_" + i)],
        );
    await db.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

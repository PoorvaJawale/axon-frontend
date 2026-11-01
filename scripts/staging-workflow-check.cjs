/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client } = require("pg");
const values = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, "../.cache/staging/.env"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("=")),
);
const db = new Client({
  host: "127.0.0.1",
  port: 55432,
  database: "axon_staging",
  user: "axon_staging_admin",
  password: values.STAGING_DB_PASSWORD,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
const owner = "workflow_test_" + crypto.randomUUID();
const other = owner + "_other";
const key = "sk-axon-" + crypto.randomBytes(24).toString("hex");
const otherKey = "sk-axon-" + crypto.randomBytes(24).toString("hex");
const hash = (k) => crypto.createHash("sha256").update(k).digest("hex");
const checks = [];
const base = {
  agent_id: "local-workflow-test",
  action_type: "api_call",
  content: { mockVerdict: "PASS" },
  mode: "validate_only",
};
async function post(body = base, token = key, idem = crypto.randomUUID()) {
  const r = await fetch(
    "http://localhost:5688/webhook/axon-local-mock-validate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
        "Idempotency-Key": idem,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    },
  );
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw Error(
      "Non-JSON workflow response HTTP " + r.status + ": " + text.slice(0, 150),
    );
  }
  return { http: r.status, json };
}
async function usage() {
  return Number(
    (
      await db.query(
        "SELECT free_used FROM public.axon_account_quota WHERE user_id=$1",
        [owner],
      )
    ).rows[0].free_used,
  );
}
async function check(label, fn) {
  await fn();
  checks.push(label);
  console.log("PASS", label);
}
async function main() {
  await db.connect();
  assert.equal(
    (await db.query("SELECT current_database() AS name")).rows[0].name,
    "axon_staging",
  );
  try {
    await db.query(
      "INSERT INTO public.axon_account_quota(user_id) VALUES($1),($2)",
      [owner, other],
    );
    await db.query(
      "INSERT INTO public.api_keys(user_id,hashed_api_key) VALUES($1,$2),($3,$4)",
      [owner, hash(key), other, hash(otherKey)],
    );
    await check("malformed input returns 400 without quota", async () => {
      assert.equal((await post({ agent_id: "missing-action" })).http, 400);
      assert.equal(await usage(), 0);
    });
    await check("invalid key returns 401", async () => {
      assert.equal((await post(base, "not-a-key")).http, 401);
    });
    await check(
      "internal reasoning is explicitly unvalidated and free",
      async () => {
        const r = await post({ ...base, action_type: "internal_reasoning" });
        assert.equal(r.http, 200);
        assert.equal(r.json.status, "SKIPPED");
        assert.equal(r.json.validated, false);
        assert.equal(await usage(), 0);
      },
    );
    await check(
      "simulated PASS returns no dispatch for validate-only",
      async () => {
        const r = await post();
        assert.equal(r.http, 200);
        assert.equal(r.json.status, "PASS");
        assert.equal(r.json.delivery, "not_requested");
        assert.equal(await usage(), 1);
      },
    );
    await check(
      "simulated BLOCK consumes one verdict without dispatch",
      async () => {
        const r = await post({ ...base, content: { mockVerdict: "BLOCK" } });
        assert.equal(r.json.status, "BLOCK");
        assert.equal(r.json.delivery, "not_attempted");
        assert.equal(await usage(), 2);
      },
    );
    await check("high-risk PASS is forced to BLOCK", async () => {
      const r = await post({ ...base, content: { mockVerdict: "HIGH" } });
      assert.equal(r.json.status, "BLOCK");
      assert.equal(await usage(), 3);
    });
    await check("malformed model output refunds reservation", async () => {
      assert.equal(
        (await post({ ...base, content: { mockVerdict: "MALFORMED" } })).http,
        503,
      );
      assert.equal(await usage(), 3);
    });
    await check(
      "model context injection is rejected and refunded",
      async () => {
        assert.equal(
          (await post({ ...base, content: { mockVerdict: "TAMPER" } })).http,
          503,
        );
        assert.equal(await usage(), 3);
      },
    );
    await check(
      "idempotency retry returns 409 without double charge",
      async () => {
        const idem = crypto.randomUUID();
        const a = await post(base, key, idem);
        assert.equal(a.http, 200);
        assert.equal((await post(base, key, idem)).http, 409);
        assert.equal(await usage(), 4);
      },
    );
    await check(
      "unverified public dispatch destination is forbidden",
      async () => {
        assert.equal(
          (
            await post({
              ...base,
              mode: "validate_and_dispatch",
              execution_endpoint: "https://example.com/axon-local",
            })
          ).http,
          403,
        );
        assert.equal(await usage(), 4);
      },
    );
    await check(
      "private callback URL is rejected before reservation",
      async () => {
        assert.equal(
          (
            await post({
              ...base,
              mode: "validate_and_dispatch",
              execution_endpoint: "http://127.0.0.1/private",
            })
          ).http,
          400,
        );
        assert.equal(await usage(), 4);
      },
    );
    await check("Free exhausted allowance returns 429", async () => {
      await db.query(
        "UPDATE public.axon_account_quota SET free_used=100 WHERE user_id=$1",
        [owner],
      );
      assert.equal((await post()).http, 429);
      assert.equal(await usage(), 100);
      await db.query(
        "UPDATE public.axon_account_quota SET free_used=4 WHERE user_id=$1",
        [owner],
      );
    });
    let request;
    await check(
      "async acceptance returns 202 only with stored job",
      async () => {
        const r = await post({ ...base, action_type: "live_chat" });
        assert.equal(r.http, 202);
        assert.equal(r.json.status, "PROCESSING");
        request = r.json.request_id;
        assert.equal(
          Number(
            (
              await db.query(
                "SELECT count(*) AS n FROM axon_security.validation_jobs WHERE request_id=$1 AND user_id=$2",
                [request, owner],
              )
            ).rows[0].n,
          ),
          1,
        );
      },
    );
    await check(
      "async worker completes simulated verdict and erases body",
      async () => {
        const end = Date.now() + 25000;
        let job;
        while (Date.now() < end) {
          job = (
            await db.query(
              "SELECT state,context,result,delivery_state FROM axon_security.validation_jobs WHERE request_id=$1",
              [request],
            )
          ).rows[0];
          if (["completed", "failed"].includes(job.state)) break;
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
        assert.equal(job.state, "completed");
        assert.equal(job.result.verdict, "PASS");
        assert.equal(job.delivery_state, "not_requested");
        assert.deepEqual(job.context, {});
      },
    );
    await check("async status is isolated between API key owners", async () => {
      const status = async (token) => {
        const r = await fetch(
          "http://localhost:5688/webhook/axon-local-mock-status?request_id=" +
            encodeURIComponent(request),
          {
            headers: { Authorization: "Bearer " + token },
            signal: AbortSignal.timeout(10000),
          },
        );
        return { http: r.status, json: await r.json() };
      };
      const own = await status(key);
      assert.equal(own.http, 200);
      const stranger = await status(otherKey);
      assert.equal(stranger.http, 404);
    });
    console.log(
      "All " +
        checks.length +
        " local workflow checks passed with SIMULATED model responses; no real model quality/payment claim.",
    );
  } finally {
    // Run only after mock workflows are unpublished if a failure leaves a queued/processing job.
    const pending = Number(
      (
        await db.query(
          "SELECT count(*) AS n FROM axon_security.validation_jobs WHERE user_id=ANY($1::text[]) AND state='processing'",
          [[owner, other]],
        )
      ).rows[0].n,
    );
    if (pending)
      console.error(
        "Processing fixture job remains; stop the mock worker before cleanup. Fixture owner:",
        owner,
      );
    else {
      for (const table of [
        "axon_security.validation_jobs",
        "axon_security.validation_inflight",
        "public.validation_logs",
        "public.axon_quota_reservation",
        "public.api_keys",
        "public.axon_account_quota",
      ])
        await db.query(
          "DELETE FROM " + table + " WHERE user_id=ANY($1::text[])",
          [[owner, other]],
        );
    }
  }
}
main()
  .catch((error) => {
    console.error(
      "Local mock workflow check failed:",
      error.code || error.name,
      error.message,
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());

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
// No production URL/hostname option: this helper is intentionally local-only.
const db = new Client({
  host: "127.0.0.1",
  port: 55432,
  database: "axon_staging",
  user: "axon_staging_admin",
  password: values.STAGING_DB_PASSWORD,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
const id = "recovery_" + crypto.randomUUID();
const hash = crypto.randomBytes(32).toString("hex");
const destination = "https://example.com/axon-local-test";
const body = {
  agent_id: "recovery-probe",
  action_type: "live_chat",
  content: "dummy content only",
  mode: "validate_and_dispatch",
  execution_endpoint: destination,
};
async function scalar(sql, args = [], field = "result") {
  return (await db.query(sql, args)).rows[0][field];
}
async function used() {
  return Number(
    await scalar(
      "SELECT free_used AS result FROM public.axon_account_quota WHERE user_id=$1",
      [id],
    ),
  );
}
async function reserve(name, route = "async", payload = body) {
  const result = await scalar(
    "SELECT axon_security.reserve_validation($1,$2,$3::jsonb,$4) AS result",
    [hash, id + ":" + name, JSON.stringify(payload), route],
  );
  assert.equal(result.quota_allowed, true, name + " should reserve");
  return id + ":" + name;
}
async function main() {
  await db.connect();
  assert.equal(
    await scalar("SELECT current_database() AS result"),
    "axon_staging",
  );
  await db.query("BEGIN");
  try {
    await db.query("SET LOCAL lock_timeout='3s'");
    await db.query(
      "LOCK TABLE axon_security.validation_jobs IN EXCLUSIVE MODE",
    );
    assert.equal(
      Number(
        await scalar(
          "SELECT count(*) AS result FROM axon_security.validation_jobs WHERE state IN ('queued','processing')",
        ),
      ),
      0,
      "Run recovery checks only with the local queue idle",
    );
    await db.query(
      "INSERT INTO public.axon_account_quota(user_id) VALUES($1)",
      [id],
    );
    await db.query(
      "INSERT INTO public.api_keys(user_id,hashed_api_key) VALUES($1,$2)",
      [id, hash],
    );
    await db.query(
      "INSERT INTO axon_security.callback_destinations(user_id,url,challenge_hash,signing_secret,verified_at) VALUES($1,$2,'dummy','dummy-local-signing-secret',now())",
      [id, destination],
    );
    const first = await reserve("cached-verdict");
    const claim1 = await scalar(
      "SELECT axon_security.claim_validation() AS result",
    );
    assert.equal(claim1.request_id, first);
    const judge = {
      verdict: "PASS",
      risk: "LOW",
      confidence: 0.99,
      category: "OTHER",
      reason: "Dummy approved action",
    };
    await scalar("SELECT axon_security.save_judge($1,$2,$3::jsonb) AS result", [
      first,
      claim1.attempt,
      JSON.stringify(judge),
    ]);
    await scalar(
      "SELECT axon_security.finish_job($1,$2,'CALLBACK_UNCONFIRMED') AS result",
      [first, claim1.attempt],
    );
    assert.equal(
      await used(),
      1,
      "Completed judgment remains charged on delivery failure",
    );
    await db.query(
      "UPDATE axon_security.validation_jobs SET next_at=now()-interval '1 second' WHERE request_id=$1",
      [first],
    );
    const claim2 = await scalar(
      "SELECT axon_security.claim_validation() AS result",
    );
    assert.equal(
      claim2.cached_judge.verdict,
      "PASS",
      "Retry must reuse its stored judgment",
    );
    assert.equal(
      await scalar("SELECT axon_security.finish_job($1,$2,NULL) AS result", [
        first,
        claim1.attempt,
      ]),
      false,
      "Old worker attempt cannot complete a new lease",
    );
    assert.equal(
      await scalar(
        "SELECT axon_security.save_judge($1,$2,$3::jsonb) AS result",
        [first, claim1.attempt, JSON.stringify(judge)],
      ),
      null,
    );
    await scalar("SELECT axon_security.finish_job($1,$2,NULL) AS result", [
      first,
      claim2.attempt,
    ]);
    const saved = await scalar(
      "SELECT to_jsonb(j) AS result FROM axon_security.validation_jobs j WHERE request_id=$1",
      [first],
    );
    assert.equal(saved.state, "completed");
    assert.equal(saved.delivery_state, "delivered");
    assert.deepEqual(saved.context, {});
    assert.equal(
      Number(
        await scalar(
          "SELECT count(*) AS result FROM public.validation_logs WHERE request_id=$1",
          [first],
        ),
      ),
      1,
    );
    console.log(
      "Durable retry: cached verdict reused, stale attempt rejected, one log, terminal content erased.",
    );

    const crash = await reserve("exhausted-worker");
    await scalar("SELECT axon_security.claim_validation() AS result");
    await db.query(
      "UPDATE axon_security.validation_jobs SET attempts=3,lease_until=now()-interval '1 second' WHERE request_id=$1",
      [crash],
    );
    await scalar("SELECT axon_security.maintain_validation() AS result");
    await scalar("SELECT axon_security.maintain_validation() AS result");
    assert.equal(await used(), 1, "Exhausted unjudged job refunds once");
    assert.equal(
      await scalar(
        "SELECT released AS result FROM public.axon_quota_reservation WHERE request_id=$1",
        [crash],
      ),
      true,
    );
    const sync = await reserve("expired-sync", "sync", {
      ...body,
      mode: "validate_only",
    });
    await db.query(
      "UPDATE axon_security.validation_inflight SET expires_at=now()-interval '1 second' WHERE request_id=$1",
      [sync],
    );
    await scalar("SELECT axon_security.maintain_validation() AS result");
    await scalar("SELECT axon_security.maintain_validation() AS result");
    assert.equal(await used(), 1, "Expired unjudged sync lease refunds once");
    console.log(
      "Crash recovery: exhausted background job and expired sync lease refunded exactly once.",
    );

    await scalar(
      "SELECT public.axon_apply_billing($1,'pro',now()-interval '1 hour',now()+interval '29 days',now(),0) AS result",
      [id],
    );
    await db.query(
      "UPDATE public.axon_account_quota SET paid_used=237 WHERE user_id=$1",
      [id],
    );
    for (let i = 0; i < 2; i++)
      await db.query(
        "SELECT public.axon_apply_billing(user_id,'pro',period_start,period_end,now(),0) FROM public.axon_account_quota WHERE user_id=$1",
        [id],
      );
    assert.equal(
      Number(
        await scalar(
          "SELECT paid_used AS result FROM public.axon_account_quota WHERE user_id=$1",
          [id],
        ),
      ),
      237,
    );
    await scalar(
      "SELECT public.axon_apply_billing($1,'free',NULL,NULL,now(),0) AS result",
      [id],
    );
    assert.equal(await used(), 1);
    console.log(
      "Billing retries preserved paid usage; upgrade/downgrade preserved lifetime Free usage.",
    );
  } finally {
    await db.query("ROLLBACK");
  }
  console.log(
    "Recovery checks passed; transaction rolled back, leaving no fixture accounts or jobs.",
  );
}
main()
  .catch((error) => {
    console.error(
      "Local recovery check failed:",
      error.code || error.name,
      error.message,
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());

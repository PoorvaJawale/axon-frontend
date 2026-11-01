/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const policy = require("../backend/n8n/policy.cjs");
const judge = {
  verdict: "PASS",
  risk: "LOW",
  confidence: 0.99,
  category: "OTHER",
  reason: "Routine action",
};
test("judge rejects context overwrite, unknown fields, malformed enums and invalid confidence", () => {
  for (const extra of [
    { user_id: "other" },
    { body: {} },
    { request_id: "other" },
    { webhook_secret: "stolen" },
  ])
    assert.throws(() => policy.parseJudge({ ...judge, ...extra }));
  for (const confidence of [-1, 2, NaN, "1"])
    assert.throws(() => policy.parseJudge({ ...judge, confidence }));
  assert.throws(() => policy.parseJudge({ ...judge, verdict: "PASSED" }));
  assert.throws(() => policy.parseJudge("```json {} ```"));
  assert.equal(
    policy.parseJudge({ ...judge, confidence: 0.4 }).verdict,
    "BLOCK",
  );
  assert.equal(policy.parseJudge({ ...judge, risk: "HIGH" }).verdict, "BLOCK");
});
test("execution mode and route are explicit and cannot be weakened by risk metadata", () => {
  const base = {
    agent_id: "agent",
    action_type: "payment",
    content: { amount: 100 },
    risk_level: "internal_reasoning",
  };
  assert.equal(policy.validateInput(base).route, "sync");
  assert.equal(policy.validateInput(base).body.mode, "validate_only");
  assert.throws(() =>
    policy.validateInput({ ...base, mode: "validate_and_dispatch" }),
  );
  assert.throws(() =>
    policy.validateInput({ ...base, content: "a".repeat(12001) }),
  );
  assert.throws(() => policy.validateInput({ ...base, metadata: [] }));
});
test("reject unsafe URLs and every private/reserved IPv4 family", () => {
  for (const url of [
    "http://example.com",
    "https://127.1",
    "https://2130706433",
    "https://0x7f000001",
    "https://[::1]",
    "https://user:pw@example.com",
    "https://example.com:444",
    "https://example.com/path?token=secret",
    "https://example.com/#x",
  ])
    assert.throws(() => policy.callbackUrl(url), url);
  for (const ip of [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.31.1.1",
    "192.168.0.1",
    "192.0.0.8",
    "198.18.1.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "255.255.255.255",
  ])
    assert.equal(policy.publicIpv4(ip), false, ip);
  assert.equal(policy.publicIpv4("93.184.216.34"), true);
});
test("private DNS answer prevents any HTTP request, including mixed answer sets", async () => {
  let calls = 0;
  await assert.rejects(() =>
    policy.pinnedPost(
      "https://callback.example.com",
      "{}",
      {},
      {
        dns: { resolve4: async () => ["93.184.216.34", "127.0.0.1"] },
        https: { request: () => calls++ },
      },
    ),
  );
  assert.equal(calls, 0);
});
test("callback signs the exact transmitted bytes and BLOCK cannot execute", () => {
  const job = {
    request_id: "event-one",
    body: { agent_id: "agent", action_type: "payment", content: { amount: 1 } },
  };
  const signed = policy.signedEnvelope(job, judge, "x".repeat(64), 1000);
  assert.equal(
    signed.headers["x-axon-signature"],
    crypto
      .createHmac("sha256", "x".repeat(64))
      .update("1000." + signed.bytes)
      .digest("hex"),
  );
  assert.equal(JSON.parse(signed.bytes).type, "action.approved");
  assert.throws(() =>
    policy.signedEnvelope(job, { ...judge, verdict: "BLOCK" }, "x".repeat(64)),
  );
  assert.throws(() => policy.signedEnvelope(job, judge, ""));
});
test("receiver rejects stale, tampered and mismatched callback events", () => {
  const secret = "s".repeat(64),
    job = {
      request_id: "event",
      body: { agent_id: "agent", action_type: "email_send", content: "hello" },
    };
  const now = 1800000000;
  const signed = policy.signedEnvelope(job, judge, secret, now);
  assert.equal(
    policy.verifyEnvelope(signed.bytes, signed.headers, secret, now).event_id,
    "event",
  );
  assert.throws(() =>
    policy.verifyEnvelope(signed.bytes, signed.headers, secret, now + 301),
  );
  assert.throws(() =>
    policy.verifyEnvelope(
      signed.bytes.replace("hello", "tampered"),
      signed.headers,
      secret,
      now,
    ),
  );
  assert.throws(() =>
    policy.verifyEnvelope(
      signed.bytes,
      { ...signed.headers, "x-axon-event-id": "other" },
      secret,
      now,
    ),
  );
});

test("migrations preserve quota, share allowance, enforce idempotency and durable async transitions", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      fs.readFileSync("tests/fixtures/inspected-schema.sql", "utf8"),
    );
    await db.exec(
      fs.readFileSync("backend/inspection/current-functions.sql", "utf8"),
    );
    for (const name of fs.readdirSync("backend/migrations").sort())
      await db.exec(fs.readFileSync("backend/migrations/" + name, "utf8"));
    await db.exec(fs.readFileSync("backend/deployment/grants.sql", "utf8"));
    await db.exec("SET ROLE axon_web");
    await db.query("SELECT * FROM public.axon_account_quota");
    await assert.rejects(() =>
      db.query("UPDATE public.axon_account_quota SET free_used=0"),
    );
    await db.exec("RESET ROLE");
    await db.exec("SET ROLE axon_validator");
    await assert.rejects(() =>
      db.query(
        "SELECT public.axon_apply_billing('owner','free',NULL,NULL,now(),0)",
      ),
    );
    await db.query(
      "SELECT axon_security.take_rate_limit(repeat('a',64),10,60)",
    );
    await db.exec("RESET ROLE");
    await db.exec(
      "INSERT INTO axon_account_quota(user_id,plan,free_used) VALUES('owner','free',99),('other','free',0); INSERT INTO api_keys(user_id,hashed_api_key,is_active,expires_at,plan,request_limit) VALUES('owner','hash-a',true,now()+interval '1 day','free',100),('owner','hash-b',true,now()+interval '1 day','free',100),('other','hash-c',true,now()+interval '1 day','free',100);",
    );
    const body = {
      agent_id: "agent",
      action_type: "live_chat",
      content: "hello",
      mode: "validate_only",
    };
    const reserve = async (hash, id, route = "async", b = body) =>
      (
        await db.query(
          "SELECT axon_security.reserve_validation($1,$2,$3::jsonb,$4) AS data",
          [hash, id, JSON.stringify(b), route],
        )
      ).rows[0].data;
    assert.equal((await reserve("hash-a", "first")).quota_allowed, true);
    assert.equal((await reserve("hash-b", "second")).http_status, 429);
    assert.equal((await reserve("hash-a", "first")).http_status, 409);
    assert.equal(
      (
        await db.query(
          "SELECT free_used FROM axon_account_quota WHERE user_id='owner'",
        )
      ).rows[0].free_used,
      100,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM axon_security.validation_jobs",
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await reserve("hash-c", "unverified", "sync", {
          ...body,
          mode: "validate_and_dispatch",
          execution_endpoint: "https://example.com/",
        })
      ).http_status,
      403,
    );
    const job = (
      await db.query("SELECT axon_security.claim_validation() AS data")
    ).rows[0].data;
    assert.equal(job.request_id, "first");
    assert.equal(job.attempt, 1);
    assert.equal(
      (
        await db.query(
          "SELECT axon_security.save_judge($1,$2,$3::jsonb) AS data",
          ["first", 9, JSON.stringify(judge)],
        )
      ).rows[0].data,
      null,
    );
    await db.query("SELECT axon_security.save_judge($1,$2,$3::jsonb)", [
      "first",
      1,
      JSON.stringify(judge),
    ]);
    await db.query("SELECT axon_security.finish_job($1,$2,$3)", [
      "first",
      1,
      null,
    ]);
    const saved = (
      await db.query(
        "SELECT * FROM axon_security.validation_jobs WHERE request_id='first'",
      )
    ).rows[0];
    assert.equal(saved.state, "completed");
    assert.equal(saved.delivery_state, "not_requested");
    assert.deepEqual(saved.context, {});
    const log = (await db.query("SELECT * FROM validation_logs")).rows[0];
    assert.equal(log.agent_id, "agent");
    assert.equal(log.raw_output, "{}");
    assert(!log.reason.includes("hello"));
    // A same-period payment retry must not refill usage; upgrade/downgrade preserve lifetime Free usage.
    await db.query(
      "SELECT axon_apply_billing('owner','pro',now()-interval '1 hour',now()+interval '29 days',now(),0)",
    );
    await db.exec(
      "UPDATE axon_account_quota SET paid_used=123 WHERE user_id='owner'",
    );
    await db.exec(
      "SELECT axon_apply_billing(user_id,'pro',period_start,period_end,now(),0) FROM axon_account_quota WHERE user_id='owner'",
    );
    assert.equal(
      (
        await db.query(
          "SELECT paid_used,free_used FROM axon_account_quota WHERE user_id='owner'",
        )
      ).rows[0].paid_used,
      123,
    );
    await db.exec(
      "SELECT axon_apply_billing('owner','free',NULL,NULL,now(),0)",
    );
    assert.equal(
      (
        await db.query(
          "SELECT free_used FROM axon_account_quota WHERE user_id='owner'",
        )
      ).rows[0].free_used,
      100,
    );
    // Durable checkout insert admits one creator even for overlapping attempts.
    const starts = await Promise.all([
      db.query(
        "INSERT INTO axon_security.checkout_operations(user_id,state,plan_id) VALUES('owner','pending','plan') ON CONFLICT(user_id) DO NOTHING RETURNING operation_id",
      ),
      db.query(
        "INSERT INTO axon_security.checkout_operations(user_id,state,plan_id) VALUES('owner','pending','plan') ON CONFLICT(user_id) DO NOTHING RETURNING operation_id",
      ),
    ]);
    assert.equal(
      starts.reduce((n, r) => n + r.rows.length, 0),
      1,
    );
    // Failed internal jobs release exactly once.
    assert.equal(
      (await reserve("hash-c", "internal-failure")).quota_allowed,
      true,
    );
    await db.exec(
      "SELECT axon_security.claim_validation();UPDATE axon_security.validation_jobs SET attempts=3 WHERE request_id='internal-failure';SELECT axon_security.finish_job('internal-failure',3,'JUDGE_UNAVAILABLE');SELECT axon_security.finish_job('internal-failure',3,'JUDGE_UNAVAILABLE');",
    );
    assert.equal(
      (
        await db.query(
          "SELECT free_used FROM axon_account_quota WHERE user_id='other'",
        )
      ).rows[0].free_used,
      0,
    );
    assert.equal(
      (await reserve("hash-c", "sync-one", "sync")).quota_allowed,
      true,
    );
    assert.equal(
      (await reserve("hash-c", "sync-two", "sync")).quota_allowed,
      true,
    );
    assert.equal(
      (await reserve("hash-c", "sync-three", "sync")).http_status,
      429,
    );
    await db.exec(
      "SELECT axon_security.finish_sync('other','sync-one',true);UPDATE axon_security.validation_inflight SET expires_at=now()-interval '1 second';SELECT axon_security.maintain_validation();SELECT axon_security.maintain_validation();",
    );
    assert.equal(
      (
        await db.query(
          "SELECT free_used FROM axon_account_quota WHERE user_id='other'",
        )
      ).rows[0].free_used,
      0,
    );
  } finally {
    await db.close();
  }
});

test("Free key default migration preserves existing paid limits and usage", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE public.api_keys(id bigserial PRIMARY KEY,plan text DEFAULT 'free',request_limit integer NOT NULL DEFAULT 1000,monthly_requests integer NOT NULL DEFAULT 0);
      INSERT INTO public.api_keys(plan,request_limit,monthly_requests) VALUES ('pro',5000,237),('free',1000,17);`);
    await db.exec(
      fs.readFileSync("backend/migrations/005_free_key_default.sql", "utf8"),
    );
    await db.exec("INSERT INTO public.api_keys DEFAULT VALUES");
    const { rows } = await db.query(
      "SELECT plan,request_limit,monthly_requests FROM public.api_keys ORDER BY id",
    );
    assert.deepEqual(rows, [
      { plan: "pro", request_limit: 5000, monthly_requests: 237 },
      { plan: "free", request_limit: 1000, monthly_requests: 17 },
      { plan: "free", request_limit: 100, monthly_requests: 0 },
    ]);
  } finally {
    await db.close();
  }
});

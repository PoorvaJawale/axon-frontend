/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { Client } = require("pg");
const local = path.resolve(__dirname, "../.cache/staging");
function read(file) {
  return Object.fromEntries(
    fs
      .readFileSync(path.join(local, file), "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim();
        if ((v[0] === '"' || v[0] === "'") && v.at(-1) === v[0])
          v = v.slice(1, -1);
        return [l.slice(0, i), v];
      }),
  );
}
const env = read("frontend.env"),
  secrets = read(".env");
const db = new Client({
  host: "127.0.0.1",
  port: 55432,
  database: "axon_staging",
  user: "axon_staging_web",
  password: secrets.STAGING_WEB_PASSWORD,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
async function main() {
  if (
    !env.RAZORPAY_KEY_ID?.startsWith("rzp_test_") ||
    !env.RAZORPAY_KEY_SECRET ||
    !env.RAZORPAY_WEBHOOK_SECRET
  )
    throw Error(
      "Complete local TEST MODE payment configuration is required; live keys refused.",
    );
  await db.connect();
  assert.equal(
    (await db.query("SELECT current_database() AS name")).rows[0].name,
    "axon_staging",
  );
  const rows = (
    await db.query(
      "SELECT q.user_id,q.plan,q.free_used,q.paid_used,q.period_start,q.period_end,c.subscription_id FROM public.axon_account_quota q JOIN axon_security.checkout_operations c USING(user_id) WHERE c.state='ready' AND c.subscription_id IS NOT NULL",
    )
  ).rows;
  assert.equal(rows.length, 1, "Expected exactly one staged sandbox checkout");
  const account = rows[0];
  assert.match(account.subscription_id, /^sub_[a-zA-Z0-9]+$/);
  const response = await fetch(
    "https://api.razorpay.com/v1/subscriptions/" + account.subscription_id,
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(
            env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET,
          ).toString("base64"),
      },
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    },
  );
  if (!response.ok)
    throw Error(
      "Test provider subscription lookup failed: HTTP " + response.status,
    );
  const subscription = await response.json();
  assert.equal(subscription.plan_id, env.RAZORPAY_PLAN_ID);
  assert.equal(subscription.notes?.clerk_user_id, account.user_id);
  if (subscription.status !== "active" || !(subscription.paid_count > 0))
    throw Error(
      "The existing sandbox subscription is " +
        subscription.status +
        " with no confirmed active paid period. Finish/check that checkout; no second payment or subscription was created by this check.",
    );
  assert.equal(account.plan, "pro");
  assert.equal(
    Math.floor(account.period_start.getTime() / 1000),
    subscription.current_start,
  );
  assert.equal(
    Math.floor(account.period_end.getTime() / 1000),
    subscription.current_end,
  );
  const limits = (
    await db.query(
      "SELECT DISTINCT request_limit FROM public.api_keys WHERE user_id=$1 AND is_active",
      [account.user_id],
    )
  ).rows;
  assert(
    limits.length > 0 && limits.every((r) => Number(r.request_limit) === 5000),
  );
  console.log(
    "Verified real Razorpay TEST subscription is active/paid; local Pro period matches and all active keys have 5,000 allowance.",
  );
  const eventId = "local_staging_replay_" + crypto.randomUUID();
  const payload = {
    event: "subscription.charged",
    created_at: Math.floor(Date.now() / 1000),
    payload: {
      subscription: {
        entity: {
          id: subscription.id,
          notes: { clerk_user_id: account.user_id },
        },
      },
    },
  };
  async function send(data, valid = true) {
    const raw = JSON.stringify(data);
    const signature = valid
      ? crypto
          .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
          .update(raw)
          .digest("hex")
      : "0".repeat(64);
    const r = await fetch("http://localhost:3101/webhook/razorpay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-razorpay-signature": signature,
        "x-razorpay-event-id": eventId,
      },
      body: raw,
      signal: AbortSignal.timeout(20000),
    });
    return { status: r.status, body: await r.json() };
  }
  assert.equal((await send(payload, false)).status, 401);
  const first = await send(payload);
  assert.equal(first.status, 200);
  assert.equal(first.body.received, true);
  const second = await send(payload);
  assert.equal(second.status, 200);
  assert.equal(second.body.duplicate, true);
  const altered = await send({
    ...payload,
    created_at: payload.created_at + 1,
  });
  assert.equal(altered.status, 409);
  assert.equal(altered.body.code, "EVENT_MISMATCH");
  const after = (
    await db.query(
      "SELECT plan,free_used,paid_used,period_start,period_end FROM public.axon_account_quota WHERE user_id=$1",
      [account.user_id],
    )
  ).rows[0];
  assert.equal(after.plan, "pro");
  assert.equal(after.free_used, account.free_used);
  assert.equal(after.paid_used, account.paid_used);
  assert.equal(after.period_start.getTime(), account.period_start.getTime());
  assert.equal(after.period_end.getTime(), account.period_end.getTime());
  assert.equal(
    (
      await db.query(
        "SELECT state FROM axon_security.webhook_events WHERE event_id=$1",
        [eventId],
      )
    ).rows[0].state,
    "completed",
  );
  console.log(
    "Webhook checks passed: invalid signature denied; signed event applied; duplicate ignored; altered payload rejected; counters and billing period preserved.",
  );
  fs.writeFileSync(
    path.join(local, "payment-check-result.json"),
    JSON.stringify(
      {
        mode: "test",
        verifiedAt: new Date().toISOString(),
        activePro: true,
        requestLimit: 5000,
        signatureRejection: true,
        duplicateIgnored: true,
        changedPayloadRejected: true,
        usagePreserved: true,
        scope:
          "Locally signed replay with canonical Test Mode API verification; public Razorpay webhook delivery not yet tested.",
      },
      null,
      2,
    ),
  );
}
main()
  .catch((error) => {
    console.error(
      "Local sandbox payment check failed:",
      error.code || error.name,
      error.message,
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());

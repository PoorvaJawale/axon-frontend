/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Client, Pool } = require("pg");
// Deliberately no configurable hostname or production DATABASE_URL fallback.
const values = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, "../.cache/staging/.env"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("=")),
);
const base = {
  host: "127.0.0.1",
  port: 55432,
  database: "axon_staging",
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
};
const admin = new Client({
  ...base,
  user: "axon_staging_admin",
  password: values.STAGING_DB_PASSWORD,
});
const validator = new Pool({
  ...base,
  user: "axon_staging_validator",
  password: values.STAGING_VALIDATOR_PASSWORD,
  max: 12,
});
const web = new Client({
  ...base,
  user: "axon_staging_web",
  password: values.STAGING_WEB_PASSWORD,
});
const runId = "local_staging_" + crypto.randomUUID();
const users = [runId + "_free", runId + "_pro"];
async function main() {
  await admin.connect();
  assert.equal(
    (await admin.query("SELECT current_database() AS name")).rows[0].name,
    "axon_staging",
  );
  try {
    for (const [index, user] of users.entries()) {
      const plan = index ? "pro" : "free";
      await admin.query(
        "INSERT INTO public.axon_account_quota(user_id,plan,free_used,paid_used,period_start,period_end) VALUES($1,$2,$3,$4,CASE WHEN $2='pro' THEN now()-interval '1 hour' END,CASE WHEN $2='pro' THEN now()+interval '29 days' END)",
        [user, plan, index ? 0 : 99, index ? 4999 : 0],
      );
      const hashes = [
        crypto.randomBytes(32).toString("hex"),
        crypto.randomBytes(32).toString("hex"),
      ];
      for (const hash of hashes)
        await admin.query(
          "INSERT INTO public.api_keys(user_id,hashed_api_key,plan,request_limit) VALUES($1,$2,$3,$4)",
          [user, hash, plan, index ? 5000 : 100],
        );
      const body = JSON.stringify({
        agent_id: "staging-probe",
        action_type: "live_chat",
        content: "dummy test only",
        mode: "validate_only",
      });
      const attempts = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          validator.query(
            "SELECT axon_security.reserve_validation($1,$2,$3::jsonb,'async') AS result",
            [hashes[i % 2], runId + "_" + index + "_" + i, body],
          ),
        ),
      );
      const allowed = attempts
        .map((r) => r.rows[0].result)
        .filter((r) => r.quota_allowed);
      assert.equal(
        allowed.length,
        1,
        plan +
          " must admit exactly one request at the boundary across both keys",
      );
      const counter = (
        await admin.query(
          "SELECT free_used,paid_used FROM public.axon_account_quota WHERE user_id=$1",
          [user],
        )
      ).rows[0];
      assert.equal(
        Number(index ? counter.paid_used : counter.free_used),
        index ? 5000 : 100,
      );
      assert.equal(
        Number(
          (
            await admin.query(
              "SELECT count(*) AS total FROM axon_security.validation_jobs WHERE user_id=$1",
              [user],
            )
          ).rows[0].total,
        ),
        1,
      );
      const requestId = allowed[0].reservation_id;
      const released = await Promise.all(
        Array.from({ length: 6 }, () =>
          validator.query(
            "SELECT public.axon_release_validation($1,$2) AS released",
            [user, requestId],
          ),
        ),
      );
      assert.equal(
        released.filter((r) => r.rows[0].released).length,
        1,
        "Release is idempotent under concurrency",
      );
      const after = (
        await admin.query(
          "SELECT free_used,paid_used FROM public.axon_account_quota WHERE user_id=$1",
          [user],
        )
      ).rows[0];
      assert.equal(
        Number(index ? after.paid_used : after.free_used),
        index ? 4999 : 99,
      );
      console.log(
        `${plan}: 12 concurrent requests across two keys respected quota; six concurrent releases refunded once.`,
      );
    }
    await web.connect();
    await web.query("SELECT count(*) FROM public.axon_account_quota");
    await assert.rejects(
      () =>
        web.query(
          "UPDATE public.axon_account_quota SET free_used=0 WHERE user_id=$1",
          [users[0]],
        ),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      () =>
        validator.query(
          "SELECT public.axon_apply_billing($1,'free',NULL,NULL,now(),0)",
          [users[0]],
        ),
      (e) => e.code === "42501",
    );
    console.log(
      "Restricted roles: web cannot reset Free usage; validator cannot change billing.",
    );
  } finally {
    // Delete only this run's exact randomly named dummy accounts, never broad table cleanup.
    await admin.query(
      "DELETE FROM axon_security.validation_jobs WHERE user_id=ANY($1::text[])",
      [users],
    );
    await admin.query(
      "DELETE FROM public.axon_quota_reservation WHERE user_id=ANY($1::text[])",
      [users],
    );
    await admin.query(
      "DELETE FROM public.api_keys WHERE user_id=ANY($1::text[])",
      [users],
    );
    await admin.query(
      "DELETE FROM public.axon_account_quota WHERE user_id=ANY($1::text[])",
      [users],
    );
  }
}
main()
  .catch((error) => {
    console.error(
      "Local staging DB check failed:",
      error.code || error.name,
      error.message,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([web.end(), validator.end(), admin.end()]);
  });

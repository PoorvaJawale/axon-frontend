/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { Client } = require("pg");
const values = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, "../.cache/staging/.env"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("=")),
);
const config = {
  host: "127.0.0.1",
  port: 55432,
  database: "axon_staging",
  user: "axon_staging_admin",
  password: values.STAGING_DB_PASSWORD,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
};
const admin = new Client(config);
const suffix = crypto.randomBytes(8).toString("hex");
const restoreName = "axon_restore_" + suffix;
const owner = "restore_fixture_" + suffix;
const dump = "/tmp/axon-local-" + suffix + ".dump";
const container = "axon-local-staging-postgres-1";
let created = false;
const docker = (args) =>
  execFileSync("docker", ["exec", container, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60000,
  });
async function main() {
  await admin.connect();
  assert.equal(
    (await admin.query("SELECT current_database() AS name")).rows[0].name,
    "axon_staging",
  );
  try {
    await admin.query(
      "INSERT INTO public.axon_account_quota(user_id,plan,free_used,paid_used,period_start,period_end) VALUES($1,'pro',17,237,now()-interval '1 hour',now()+interval '29 days')",
      [owner],
    );
    docker([
      "pg_dump",
      "-U",
      "axon_staging_admin",
      "-d",
      "axon_staging",
      "--format=custom",
      "--file=" + dump,
    ]);
    assert.match(restoreName, /^axon_restore_[a-f0-9]{16}$/);
    // Filesystem recovery work needs a longer operator timeout than app queries.
    await admin.query("SET statement_timeout='60s'");
    await admin.query('CREATE DATABASE "' + restoreName + '"');
    created = true;
    docker([
      "pg_restore",
      "-U",
      "axon_staging_admin",
      "--exit-on-error",
      "--dbname=" + restoreName,
      dump,
    ]);
    const restored = new Client({ ...config, database: restoreName });
    const web = new Client({
      ...config,
      database: restoreName,
      user: "axon_staging_web",
      password: values.STAGING_WEB_PASSWORD,
    });
    try {
      await restored.connect();
      const row = (
        await restored.query(
          "SELECT plan,free_used,paid_used,period_start<period_end AS dates_ok FROM public.axon_account_quota WHERE user_id=$1",
          [owner],
        )
      ).rows[0];
      assert.equal(row.plan, "pro");
      assert.equal(Number(row.free_used), 17);
      assert.equal(Number(row.paid_used), 237);
      assert.equal(row.dates_ok, true);
      const functions = Number(
        (
          await restored.query(
            "SELECT count(*) AS n FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='axon_security' AND p.proname IN ('reserve_validation','claim_validation','finish_job','maintain_validation')",
          )
        ).rows[0].n,
      );
      assert.equal(functions, 4);
      await web.connect();
      await web.query(
        "SELECT * FROM public.axon_account_quota WHERE user_id=$1",
        [owner],
      );
      await assert.rejects(
        () =>
          web.query(
            "UPDATE public.axon_account_quota SET free_used=0 WHERE user_id=$1",
            [owner],
          ),
        (e) => e.code === "42501",
      );
      console.log(
        "Local pg_dump/pg_restore passed: paid plan, both usage counters, billing dates, job functions and web-role restrictions survived restore.",
      );
    } finally {
      await Promise.allSettled([web.end(), restored.end()]);
    }
  } finally {
    await admin.query(
      "DELETE FROM public.axon_account_quota WHERE user_id=$1",
      [owner],
    );
    if (created) await admin.query('DROP DATABASE "' + restoreName + '"');
    docker(["rm", "-f", dump]);
  }
  console.log(
    "Removed only the generated fixture, temporary restore database and temporary dump. Source staging database retained.",
  );
}
main()
  .catch((error) => {
    console.error(
      "Local restore check failed:",
      error.code || error.name,
      error.message,
    );
    process.exitCode = 1;
  })
  .finally(() => admin.end());

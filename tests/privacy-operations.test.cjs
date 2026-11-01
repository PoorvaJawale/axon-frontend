/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const vm = require("vm");
const { PGlite } = require("@electric-sql/pglite");
test("operator deletion is dry-run first, drains work, and retries partial identity failure without crossing tenants", async () => {
  const db = new PGlite();
  const id = "123e4567-e89b-12d3-a456-426614174000";
  let deleted = false,
    identityFailure = true;
  await db.exec(
    "CREATE TABLE api_keys(id bigserial PRIMARY KEY,user_id text,is_active boolean,updated_at timestamptz);CREATE TABLE axon_account_quota(user_id text PRIMARY KEY,plan text,period_end timestamptz);CREATE TABLE axon_quota_reservation(user_id text);CREATE TABLE validation_logs(user_id text);",
  );
  await db.exec(
    fs.readFileSync("backend/migrations/001_control_security.sql", "utf8"),
  );
  await db.exec(
    "CREATE TABLE axon_security.validation_jobs(user_id text,state text,lease_until timestamptz);CREATE TABLE axon_security.validation_inflight(user_id text,expires_at timestamptz);CREATE TABLE axon_security.callback_destinations(user_id text);",
  );
  await db.query(
    "INSERT INTO axon_security.privacy_requests(id,user_id,kind) VALUES($1,'a','delete')",
    [id],
  );
  await db.exec(
    "INSERT INTO api_keys(user_id,is_active) VALUES('a',true),('b',true);INSERT INTO axon_account_quota VALUES('a','free',NULL),('b','free',NULL);INSERT INTO validation_logs VALUES('a'),('b');",
  );
  async function run(apply) {
    const lines = [],
      state = {};
    const argv = [
      "node",
      "script",
      "--request",
      id,
      ...(apply
        ? [
            "--apply",
            "--confirm-user",
            "a",
            "--provider-retention-reviewed",
            "--backup-retention-reviewed",
            "--control-deploy-verified",
          ]
        : []),
    ];
    await vm.runInNewContext(
      fs.readFileSync("scripts/privacy-delete.cjs", "utf8"),
      {
        Date,
        URL,
        Buffer,
        Set,
        AbortSignal,
        process: {
          argv,
          env: {
            AXON_MAINTENANCE_DATABASE_URL:
              "postgres://fixture@db.example/test?sslmode=verify-full",
            CLERK_SECRET_KEY: "fixture",
          },
          set exitCode(n) {
            state.exitCode = n;
          },
        },
        console: { log: (s) => lines.push(s), error: (s) => lines.push(s) },
        require: (n) =>
          n === "pg"
            ? {
                Pool: class {
                  async connect() {
                    return { query: (s, v) => db.query(s, v), release() {} };
                  }
                  async end() {}
                },
              }
            : {
                createClerkClient: () => ({
                  users: {
                    getUser: async () => ({ privateMetadata: {} }),
                    deleteUser: async () => {
                      if (identityFailure) throw Error("Provider unavailable");
                      deleted = true;
                    },
                  },
                }),
              },
      },
    );
    return { lines, state };
  }
  try {
    await run(false);
    assert.equal(
      (await db.query("SELECT is_active FROM api_keys WHERE user_id='a'"))
        .rows[0].is_active,
      true,
    );
    await run(true);
    assert.equal(
      (await db.query("SELECT is_active FROM api_keys WHERE user_id='a'"))
        .rows[0].is_active,
      false,
    );
    assert.equal(
      (await db.query("SELECT state FROM axon_security.privacy_requests"))
        .rows[0].state,
      "processing",
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM validation_logs WHERE user_id='a'",
        )
      ).rows[0].n,
      1,
    );
    await db.exec(
      "UPDATE axon_security.privacy_requests SET started_at=now()-interval '4 minutes';INSERT INTO axon_security.validation_inflight VALUES('a',now()+interval '1 hour')",
    );
    assert.equal((await run(true)).state.exitCode, 1);
    assert.equal(deleted, false);
    await db.exec("DELETE FROM axon_security.validation_inflight");
    const interrupted = await run(true);
    assert.equal(interrupted.state.exitCode, 1);
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM api_keys WHERE user_id='a'",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("SELECT state FROM axon_security.privacy_requests"))
        .rows[0].state,
      "processing",
    );
    identityFailure = false;
    const completed = await run(true);
    assert.equal(completed.state.exitCode, undefined);
    assert.equal(deleted, true);
    assert.equal(
      (await db.query("SELECT state FROM axon_security.privacy_requests"))
        .rows[0].state,
      "completed",
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM api_keys WHERE user_id='b'",
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM validation_logs WHERE user_id='b'",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});

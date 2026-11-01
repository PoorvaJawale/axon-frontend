/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { Client } = require("pg");
const root = path.resolve(__dirname, "..");
const local = path.join(root, ".cache/staging");
const secrets = Object.fromEntries(
  fs
    .readFileSync(path.join(local, ".env"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split("=")),
);
const config = JSON.parse(
  fs.readFileSync(path.join(local, "model-eval-config.json"), "utf8"),
);
const cases = JSON.parse(
  fs.readFileSync(path.join(root, "backend/evals/launch-smoke.json"), "utf8"),
);
const user = "model_eval_" + crypto.randomUUID();
const key = "sk-axon-" + crypto.randomBytes(24).toString("hex");
const db = new Client({
  host: "127.0.0.1",
  port: 55432,
  database: "axon_staging",
  user: "axon_staging_admin",
  password: secrets.STAGING_DB_PASSWORD,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
async function main() {
  assert(
    cases.length > 0 && cases.length <= 16,
    "Bounded evaluation: at most 16 native model calls, no automatic retries",
  );
  assert.match(config.path, /^axon-model-eval-[a-f0-9]{24}$/);
  for (const c of cases) {
    assert(["PASS", "BLOCK"].includes(c.expected));
    assert(Buffer.byteLength(JSON.stringify(c.content)) <= 2000);
    assert.notEqual(c.action_type, "live_chat");
  }
  await db.connect();
  assert.equal(
    (await db.query("SELECT current_database() AS name")).rows[0].name,
    "axon_staging",
  );
  const results = [];
  try {
    await db.query(
      "INSERT INTO public.axon_account_quota(user_id) VALUES($1)",
      [user],
    );
    await db.query(
      "INSERT INTO public.api_keys(user_id,hashed_api_key,name) VALUES($1,$2,'Synthetic model evaluation only')",
      [user, crypto.createHash("sha256").update(key).digest("hex")],
    );
    for (const c of cases) {
      const started = Date.now();
      const response = await fetch(
        "http://localhost:5688/webhook/" + config.path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + key,
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            agent_id: "local-model-eval",
            action_type: c.action_type,
            content: c.content,
            mode: "validate_only",
          }),
          signal: AbortSignal.timeout(25000),
        },
      );
      const text = await response.text();
      let actual = "INVALID_RESPONSE";
      try {
        actual = JSON.parse(text).status || "INVALID_RESPONSE";
      } catch {
        /* Response contents are not logged. */
      }
      const pass = response.status === 200 && actual === c.expected;
      results.push({
        id: c.id,
        expected: c.expected,
        actual,
        http: response.status,
        pass,
        latencyMs: Date.now() - started,
      });
      console.log(
        (pass ? "PASS " : "FAIL ") +
          c.id +
          " expected=" +
          c.expected +
          " actual=" +
          actual +
          " HTTP=" +
          response.status,
      );
      if (response.status !== 200) {
        console.error(
          "Stopping evaluation after a transport/model failure; no automatic retry or additional paid calls.",
        );
        break;
      }
    }
    const report = {
      model: "gpt-4o-mini",
      completedAt: new Date().toISOString(),
      synthetic: true,
      nativeN8nHttp: true,
      totalPlanned: cases.length,
      totalRun: results.length,
      passed: results.filter((r) => r.pass).length,
      falsePasses: results.filter(
        (r) => r.expected === "BLOCK" && r.actual === "PASS",
      ).length,
      falseBlocks: results.filter(
        (r) => r.expected === "PASS" && r.actual === "BLOCK",
      ).length,
      results,
      limitation:
        "Small hand-labeled synthetic smoke set; not evidence of production false-PASS rates, compliance or comprehensive safety.",
    };
    fs.writeFileSync(
      path.join(local, "model-eval-result.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      "Synthetic smoke result: " +
        report.passed +
        "/" +
        report.totalPlanned +
        "; false PASS=" +
        report.falsePasses +
        ", false BLOCK=" +
        report.falseBlocks +
        ". This is not a safety guarantee.",
    );
    if (report.passed !== cases.length) process.exitCode = 1;
  } finally {
    for (const table of [
      "axon_security.validation_inflight",
      "public.validation_logs",
      "public.axon_quota_reservation",
      "public.api_keys",
      "public.axon_account_quota",
    ])
      await db.query("DELETE FROM " + table + " WHERE user_id=$1", [user]);
  }
}
main()
  .catch((error) => {
    console.error(
      "Local model evaluation failed:",
      error.code || error.name,
      error.message,
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());

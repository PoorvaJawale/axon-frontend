/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const { pipeline } = require("node:stream/promises");
const {
  authenticateBackup,
  decryptStream,
} = require("../backend/operations/backup-crypto.cjs");
const root = path.resolve(__dirname, "..");
const local = path.join(root, ".cache/recovery");
const container = "axon-offline-recovery-postgres18";
const action = process.argv[2];
function docker(args, options = {}) {
  try {
    return execFileSync("docker", args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024,
      ...options,
    });
  } catch {
    throw Error(
      "Offline PostgreSQL operation failed; raw database output suppressed.",
    );
  }
}
function sql(db, statement) {
  return docker([
    "exec",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    db,
    "-v",
    "ON_ERROR_STOP=1",
    "-Atc",
    statement,
  ]).trim();
}
function apply(db, text) {
  docker(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      db,
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    { input: text },
  );
}
function migrationSql() {
  return (
    fs
      .readdirSync(path.join(root, "backend/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()
      .map((n) =>
        fs.readFileSync(path.join(root, "backend/migrations", n), "utf8"),
      )
      .join("\n") +
    "\n" +
    fs.readFileSync(path.join(root, "backend/deployment/grants.sql"), "utf8")
  );
}
async function prepare() {
  fs.mkdirSync(local, { recursive: true });
  const data = path.join(local, "postgres18");
  fs.mkdirSync(data, { recursive: true });
  const env = path.join(local, "postgres18.env");
  if (!fs.existsSync(env))
    fs.writeFileSync(
      env,
      "POSTGRES_PASSWORD=" +
        crypto.randomBytes(32).toString("hex") +
        "\nPOSTGRES_DB=axon_recovery\n",
      { flag: "wx", mode: 0o600 },
    );
  let exists = false;
  try {
    exists =
      execFileSync(
        "docker",
        [
          "inspect",
          "--format",
          '{{ index .Config.Labels "com.axon.offline-recovery" }}',
          container,
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim() === "true";
  } catch {
    /* No recovery container yet. */
  }
  if (!exists)
    docker([
      "run",
      "-d",
      "--name",
      container,
      "--label",
      "com.axon.offline-recovery=true",
      "--network",
      "none",
      "--memory",
      "512m",
      "--cpus",
      "1",
      "--env-file",
      env,
      "--mount",
      "type=bind,source=" + data + ",target=/var/lib/postgresql",
      "postgres:18.6",
    ]);
  else docker(["start", container]);
  assert.equal(
    docker([
      "inspect",
      "--format",
      "{{.HostConfig.NetworkMode}}",
      container,
    ]).trim(),
    "none",
    "Restored production data must not be network-accessible",
  );
  for (let i = 0; i < 40; i++) {
    try {
      if (sql("axon_recovery", "SELECT 1") === "1") {
        console.log(
          "Offline PostgreSQL 18.6 ready on D: with no network and no exposed ports.",
        );
        return;
      }
    } catch {
      /* Initial bootstrap. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw Error(
    "Offline recovery PostgreSQL did not become ready; no restore attempted",
  );
}
function createDatabase(prefix) {
  const name = prefix + crypto.randomBytes(8).toString("hex");
  assert.match(name, /^axon_(schema18|restore18)_[a-f0-9]{16}$/);
  sql("axon_recovery", 'CREATE DATABASE "' + name + '"');
  return name;
}
function snapshot(db) {
  return JSON.parse(
    sql(
      db,
      `SELECT json_build_object(
    'quotaDigest',(SELECT md5(COALESCE(string_agg(row_to_json(q)::text,chr(10) ORDER BY user_id),'')) FROM public.axon_account_quota q),
    'keyDigest',(SELECT md5(COALESCE(string_agg(row_to_json(k)::text,chr(10) ORDER BY id),'')) FROM public.api_keys k),
    'accounts',(SELECT count(*) FROM public.axon_account_quota),
    'keys',(SELECT count(*) FROM public.api_keys),
    'logs',(SELECT count(*) FROM public.validation_logs));`,
    ),
  );
}
async function restore() {
  const directory = path.join(root, ".cache/production-backups");
  const candidates = fs
    .readdirSync(directory)
    .filter((n) => n.startsWith("appdb-") && n.endsWith(".json"))
    .sort();
  if (!candidates.length)
    throw Error("No authenticated encrypted application backup is available");
  const metaFile = path.join(directory, candidates.at(-1));
  const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
  if (
    meta.target !== "appdb" ||
    !meta.authenticated ||
    path.basename(meta.encryptedFile) !== meta.encryptedFile
  )
    throw Error("Unexpected application backup metadata");
  const file = path.join(directory, meta.encryptedFile);
  const key = fs.readFileSync(
    path.join(root, ".cache/recovery-keys/backup-aes256.key"),
  );
  const actualHash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) actualHash.update(chunk);
  assert.equal(actualHash.digest("hex"), meta.encryptedSha256);
  await authenticateBackup(file, key, Buffer.from("PGDMP"));
  apply(
    "axon_recovery",
    fs.readFileSync(
      path.join(root, "backend/operations/recovery-roles.sql"),
      "utf8",
    ),
  );
  const database = createDatabase("axon_restore18_");
  // Decrypt a second pass only after complete AEAD authentication. No plaintext dump is written.
  const child = spawn(
    "docker",
    [
      "exec",
      "-i",
      container,
      "pg_restore",
      "-U",
      "postgres",
      "--dbname=" + database,
      "--exit-on-error",
    ],
    { stdio: ["pipe", "ignore", "pipe"], windowsHide: true },
  );
  child.stderr.resume();
  const exited = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  });
  await pipeline(decryptStream(file, key), child.stdin);
  if ((await exited) !== 0)
    throw Error(
      "Offline restore failed; database retained for restricted review, raw output suppressed",
    );
  const before = snapshot(database);
  apply(database, migrationSql());
  const after = snapshot(database);
  assert.deepEqual(
    after,
    before,
    "Migration must preserve every existing quota/key row and log count",
  );
  assert.equal(
    sql(
      database,
      "SELECT has_table_privilege('axon_web','public.api_keys','SELECT')",
    ),
    "t",
  );
  assert.equal(
    sql(
      database,
      "SELECT has_column_privilege('axon_web','public.axon_account_quota','free_used','UPDATE')",
    ),
    "f",
  );
  assert.equal(
    sql(
      database,
      "SELECT has_function_privilege('axon_validator','public.axon_apply_billing(text,text,timestamptz,timestamptz,timestamptz,bigint)','EXECUTE')",
    ),
    "f",
  );
  const result = {
    recoveredAt: new Date().toISOString(),
    database,
    container,
    network: "none",
    postgres: "18.6",
    backupFile: path.basename(file),
    counts: { accounts: after.accounts, keys: after.keys, logs: after.logs },
    allFiveMigrationsPassed: true,
    quotaAndKeyRowsUnchanged: true,
    restrictedRoleChecksPassed: true,
    productionModified: false,
  };
  fs.writeFileSync(
    path.join(local, "appdb-restore-result.json"),
    JSON.stringify(result, null, 2),
    { mode: 0o600 },
  );
  fs.writeFileSync(
    metaFile,
    JSON.stringify(
      {
        ...meta,
        restored: true,
        restoreVerifiedAt: result.recoveredAt,
        offlineDatabase: database,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(result));
  console.log(
    "The offline database now contains the explicitly approved production recovery copy. It is retained only in the private local D: Docker storage; no workflow is connected to it.",
  );
}
async function main() {
  if (!["prepare", "schema-check", "restore"].includes(action))
    throw Error("Use prepare, schema-check or restore");
  await prepare();
  if (action === "schema-check") {
    const db = createDatabase("axon_schema18_");
    try {
      apply(
        db,
        fs.readFileSync(
          path.join(root, "tests/fixtures/inspected-schema.sql"),
          "utf8",
        ) +
          "\n" +
          fs.readFileSync(
            path.join(root, "backend/inspection/current-functions.sql"),
            "utf8",
          ) +
          "\n" +
          migrationSql(),
      );
      assert.equal(
        sql(
          db,
          "SELECT current_setting('server_version_num')::integer >= 180000",
        ),
        "t",
      );
      console.log(
        "Synthetic PostgreSQL 18 schema, five migrations and role grants passed.",
      );
    } finally {
      sql("axon_recovery", 'DROP DATABASE "' + db + '"');
    }
  } else if (action === "restore") await restore();
}
main().catch((error) => {
  console.error("Offline recovery check failed:", error.message);
  process.exitCode = 1;
});

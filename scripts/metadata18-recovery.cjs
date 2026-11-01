/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawn, spawnSync } = require("node:child_process"),
  { pipeline } = require("node:stream/promises");
const {
  authenticateBackup,
  decryptStream,
} = require("../backend/operations/backup-crypto.cjs");
const root = path.resolve(__dirname, ".."),
  container = "axon-offline-recovery-postgres18";
function docker(args, input) {
  const r = spawnSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  if (r.status !== 0)
    throw Error(
      "Offline metadata operation failed; raw database output withheld",
    );
  return r.stdout.trim();
}
async function main() {
  if (
    docker([
      "inspect",
      "--format",
      "{{.HostConfig.NetworkMode}}",
      container,
    ]) !== "none"
  )
    throw Error("Recovery container must remain offline");
  const directory = path.join(root, ".cache/production-backups"),
    name = fs
      .readdirSync(directory)
      .filter((n) => n.startsWith("n8ndb-") && n.endsWith(".json"))
      .sort()
      .at(-1),
    meta = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
  if (
    !meta.authenticated ||
    path.basename(meta.encryptedFile) !== meta.encryptedFile
  )
    throw Error("Unexpected metadata artifact");
  const file = path.join(directory, meta.encryptedFile),
    key = fs.readFileSync(
      path.join(root, ".cache/recovery-keys/backup-aes256.key"),
    );
  const digest = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
  if (digest.digest("hex") !== meta.encryptedSha256)
    throw Error("Backup checksum mismatch");
  await authenticateBackup(file, key, Buffer.from("PGDMP"));
  docker(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "axon_recovery",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    fs.readFileSync(
      path.join(root, "backend/operations/recovery-roles.sql"),
      "utf8",
    ),
  );
  const database = "axon_n8n18_" + crypto.randomBytes(8).toString("hex");
  docker([
    "exec",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    "axon_recovery",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    'CREATE DATABASE "' + database + '"',
  ]);
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
    child.on("close", resolve);
  });
  await pipeline(decryptStream(file, key), child.stdin);
  if ((await exited) !== 0)
    throw Error(
      "Metadata restore failed; offline database retained for review",
    );
  const counts = JSON.parse(
    docker([
      "exec",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      database,
      "-Atc",
      "SELECT json_build_object('workflows',(SELECT count(*) FROM workflow_entity),'active',(SELECT count(*) FROM workflow_entity WHERE active),'credentials',(SELECT count(*) FROM credentials_entity),'version',current_setting('server_version'));",
    ]),
  );
  if (counts.active !== 4 || counts.credentials !== 5)
    throw Error("Unexpected restored metadata counts");
  const localEnv = Object.fromEntries(
    fs
      .readFileSync(path.join(root, ".cache/recovery/postgres18.env"), "utf8")
      .trim()
      .split(/\r?\n/)
      .map((l) => l.split("=")),
  );
  const env = path.join(root, ".cache/recovery/n8n18-check.env");
  fs.writeFileSync(
    env,
    [
      "DB_TYPE=postgresdb",
      "DB_POSTGRESDB_HOST=127.0.0.1",
      "DB_POSTGRESDB_PORT=5432",
      "DB_POSTGRESDB_DATABASE=" + database,
      "DB_POSTGRESDB_USER=postgres",
      "DB_POSTGRESDB_PASSWORD=" + localEnv.POSTGRES_PASSWORD,
      "DB_POSTGRESDB_SSL_ENABLED=false",
      "N8N_ENCRYPTION_KEY=" + crypto.randomBytes(32).toString("hex"),
      "N8N_DIAGNOSTICS_ENABLED=false",
      "N8N_VERSION_NOTIFICATIONS_ENABLED=false",
      "N8N_LICENSE_AUTO_RENEW_ENABLED=false",
    ].join("\n") + "\n",
    { mode: 0o600 },
  );
  try {
    const result = docker([
      "run",
      "--rm",
      "--network",
      "container:" + container,
      "--env-file",
      env,
      "n8nio/n8n:2.45.7@sha256:9a8d8dcea75667496695d7810d7e1fe018a65efb36cc499d347f3931b3957b5d",
      "list:workflow",
    ]);
    for (const id of [
      "axonProdValidation1",
      "axonProdWorker1",
      "axonProdStatus1",
      "nqwVZXqGsOwOhT0T",
    ])
      if (!result.includes(id))
        throw Error("CLI metadata verification missing workflow");
  } finally {
    fs.rmSync(env, { force: true });
  }
  const report = {
    at: new Date().toISOString(),
    database,
    backupMetadata: name,
    counts,
    offline: true,
    n8nCliCompatible: true,
    credentialDecryptionTested: false,
    productionModified: false,
  };
  fs.writeFileSync(
    path.join(root, ".cache/recovery/n8n18-restore-result.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

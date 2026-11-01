/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  path = require("node:path"),
  { spawn, spawnSync } = require("node:child_process"),
  { pipeline } = require("node:stream/promises"),
  crypto = require("node:crypto");
const {
  authenticateBackup,
  decryptStream,
} = require("../backend/operations/backup-crypto.cjs");
const root = path.resolve(__dirname, ".."),
  exe = path.join(
    process.env.APPDATA,
    "npm/node_modules/@railway/cli/bin/railway.exe",
  ),
  project = "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f",
  environment = "692d14bf-022f-4bb5-9f14-702f8ee8b606",
  service = "af53601a-765e-4d4e-b855-641f803d757c";
function ssh(command, input) {
  const r = spawnSync(
    exe,
    [
      "ssh",
      "--project",
      project,
      "--environment",
      environment,
      "--service",
      service,
      "--",
      command,
    ],
    { input, encoding: "utf8", windowsHide: true, timeout: 120000 },
  );
  if (r.status !== 0)
    throw Error("Metadata18 operation failed; raw output withheld");
  return r.stdout.trim();
}
async function main() {
  const count = ssh(
    'psql -U "$PGUSER" -d "$PGDATABASE" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema=\'public\'"',
  );
  if (count !== "0")
    throw Error(
      "Replacement database is not empty; never restore over existing data",
    );
  const dir = path.join(root, ".cache/production-backups"),
    name = fs
      .readdirSync(dir)
      .filter((x) => x.startsWith("n8ndb-") && x.endsWith(".json"))
      .sort()
      .at(-1),
    meta = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  if (
    !meta.authenticated ||
    Date.now() - fs.statSync(path.join(dir, name)).mtimeMs > 15 * 60_000
  )
    throw Error("Fresh authenticated metadata backup required");
  const file = path.join(dir, meta.encryptedFile),
    key = fs.readFileSync(
      path.join(root, ".cache/recovery-keys/backup-aes256.key"),
    ),
    hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  if (hash.digest("hex") !== meta.encryptedSha256)
    throw Error("Backup digest mismatch");
  await authenticateBackup(file, key, Buffer.from("PGDMP"));
  const child = spawn(
    exe,
    [
      "ssh",
      "--project",
      project,
      "--environment",
      environment,
      "--service",
      service,
      "--",
      'pg_restore -U "$PGUSER" -d "$PGDATABASE" --single-transaction --exit-on-error',
    ],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  child.stdout.resume();
  child.stderr.resume();
  const exited = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  await pipeline(decryptStream(file, key), child.stdin);
  if ((await exited) !== 0)
    throw Error("Replacement restore failed; transaction not committed");
  const output = ssh(
    'psql -U "$PGUSER" -d "$PGDATABASE" -At',
    "SELECT json_build_object('version',current_setting('server_version'),'workflows',(SELECT count(*) FROM workflow_entity),'active',(SELECT count(*) FROM workflow_entity WHERE active),'credentials',(SELECT count(*) FROM credentials_entity));",
  );
  const result = JSON.parse(output);
  if (
    result.active !== 4 ||
    result.credentials !== 5 ||
    !result.version.startsWith("18.")
  )
    throw Error("Replacement metadata verification failed");
  const report = {
    at: new Date().toISOString(),
    service,
    backupMetadata: name,
    result,
    n8nSwitched: false,
  };
  fs.writeFileSync(
    path.join(root, ".cache/production-deployment/metadata18-transfer.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

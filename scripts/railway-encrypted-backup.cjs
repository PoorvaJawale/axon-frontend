/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const readline = require("node:readline");
const { spawn } = require("node:child_process");
const { Readable } = require("node:stream");
const {
  encryptToFile,
  authenticateBackup,
} = require("../backend/operations/backup-crypto.cjs");
const root = path.resolve(__dirname, "..");
const project = "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f";
const environment = "692d14bf-022f-4bb5-9f14-702f8ee8b606";
const targets = {
  appdb: {
    service: "34c598c5-2293-4024-baeb-0b48a9b78677",
    kind: "postgres-custom",
  },
  n8ndb: {
    service: "af53601a-765e-4d4e-b855-641f803d757c",
    kind: "postgres-custom",
  },
  n8ndb16: {
    service: "8903014e-6048-4f1f-b792-c5f8045b177a",
    kind: "postgres-custom",
  },
  n8nkey: {
    service: "7e26464d-ff3f-4aa0-9d9b-b1dff1a28fa9",
    kind: "n8n-encryption-key",
  },
};
const targetName = process.argv[2];
const target = targets[targetName];
const quote = (text) => "'" + text.replace(/'/g, "'\"'\"'") + "'";
async function main() {
  if (!target)
    throw Error(
      "Select appdb, n8ndb, n8ndb16 (retired rollback DB) or n8nkey; selectors are pinned.",
    );
  const exe = path.join(
    process.env.APPDATA,
    "npm/node_modules/@railway/cli/bin/railway.exe",
  );
  if (!fs.existsSync(exe))
    throw Error("Expected installed Railway executable is unavailable");
  const keyDir = path.join(root, ".cache/recovery-keys");
  const directory = path.join(root, ".cache/production-backups");
  fs.mkdirSync(keyDir, { recursive: true });
  fs.mkdirSync(directory, { recursive: true });
  const keyFile = path.join(keyDir, "backup-aes256.key");
  if (!fs.existsSync(keyFile))
    fs.writeFileSync(keyFile, crypto.randomBytes(32), {
      flag: "wx",
      mode: 0o600,
    });
  const key = fs.readFileSync(keyFile);
  if (key.length !== 32)
    throw Error("Unexpected recovery key file; not overwritten");
  const suffix =
    new Date().toISOString().replace(/[:.]/g, "-") +
    "-" +
    crypto.randomBytes(4).toString("hex");
  const base = targetName + "-" + suffix;
  const partial = path.join(directory, base + ".partial.enc");
  const final = path.join(directory, base + ".enc");
  let remote;
  if (target.kind === "postgres-custom") {
    const shell =
      "set -euo pipefail; printf '%s\\n' AXON_BACKUP_BEGIN; pg_dump -U \"$PGUSER\" -d \"$PGDATABASE\" --format=custom | base64; printf '%s\\n' AXON_BACKUP_END";
    remote = "bash -c " + quote(shell);
  } else {
    const script =
      "const k=process.env.N8N_ENCRYPTION_KEY;if(!k)throw Error('Encryption key missing');console.log('AXON_BACKUP_BEGIN');console.log(Buffer.from(JSON.stringify({N8N_ENCRYPTION_KEY:k})).toString('base64'));console.log('AXON_BACKUP_END');";
    remote = "node -e " + quote(script);
  }
  const child = spawn(
    exe,
    [
      "ssh",
      "--project",
      project,
      "--environment",
      environment,
      "--service",
      target.service,
      "--",
      remote,
    ],
    { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  // Drain diagnostics but never emit them: providers/SSH may include identities or data.
  child.stderr.resume();
  const exit = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  });
  const deadline = setTimeout(() => child.kill(), 10 * 60 * 1000);
  let began = false,
    ended = false,
    bytes = 0;
  async function* payload() {
    const lines = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });
    for await (const raw of lines) {
      const line = raw.trim();
      if (!began) {
        if (line === "AXON_BACKUP_BEGIN") began = true;
        continue;
      }
      if (ended) continue;
      if (line === "AXON_BACKUP_END") {
        ended = true;
        continue;
      }
      if (!line) continue;
      if (!/^[A-Za-z0-9+/=]+$/.test(line) || line.length > 32768)
        throw Error("Unexpected framed backup transport; payload suppressed");
      const chunk = Buffer.from(line, "base64");
      bytes += chunk.length;
      if (bytes > 250 * 1024 * 1024)
        throw Error(
          "Backup exceeds this bounded operator transfer; no complete backup recorded",
        );
      yield chunk;
    }
    if (!began || !ended || (await exit) !== 0)
      throw Error(
        "Remote backup did not complete cleanly; partial encrypted artifact retained",
      );
  }
  try {
    await encryptToFile(Readable.from(payload()), partial, key);
    const verifiedBytes = await authenticateBackup(
      partial,
      key,
      Buffer.from(target.kind === "postgres-custom" ? "PGDMP" : "{"),
    );
    if (verifiedBytes !== bytes) throw Error("Backup size verification failed");
    for (const file of [partial, final])
      if (!path.resolve(file).startsWith(directory + path.sep))
        throw Error("Unsafe local backup path");
    fs.renameSync(partial, final);
    const encryptedHash = crypto.createHash("sha256");
    for await (const chunk of fs.createReadStream(final))
      encryptedHash.update(chunk);
    const metadata = {
      target: targetName,
      kind: target.kind,
      project,
      environment,
      service: target.service,
      createdAt: new Date().toISOString(),
      encryptedFile: path.basename(final),
      plaintextBytes: bytes,
      encryptedSha256: encryptedHash.digest("hex"),
      cipher: "AES-256-GCM",
      authenticated: true,
      restored: false,
    };
    fs.writeFileSync(
      path.join(directory, base + ".json"),
      JSON.stringify(metadata, null, 2),
      { mode: 0o600, flag: "wx" },
    );
    console.log(
      JSON.stringify({
        target: targetName,
        encryptedBackup: final,
        plaintextBytes: bytes,
        authenticated: true,
        restored: false,
        note: "Production data was read only; backup/key values not displayed. Recovery key is separate under ignored .cache/recovery-keys; preserve it securely.",
      }),
    );
  } finally {
    clearTimeout(deadline);
    child.kill();
  }
}
main().catch((error) => {
  console.error("Encrypted backup failed:", error.message);
  process.exitCode = 1;
});

/* eslint-disable @typescript-eslint/no-require-imports */
// Dry run by default. Deletes only expired encrypted source artifacts/receipts, never keys, transfers or restored DBs.
const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");
const { planRetention } = require("../backend/operations/backup-retention.cjs");
const {
  authenticateBackup,
} = require("../backend/operations/backup-crypto.cjs");
async function main() {
  const root = path.resolve(__dirname, "..");
  if (root.toLowerCase() !== "d:\\axon-frontend")
    throw Error("Approved D: workspace required");
  const directory = path.join(root, ".cache/production-backups");
  if (
    fs.lstatSync(directory).isSymbolicLink() ||
    fs.realpathSync(directory).toLowerCase() !== directory.toLowerCase()
  )
    throw Error("Backup directory must not redirect");
  const entries = [];
  for (const name of fs.readdirSync(directory)) {
    if (!/^(appdb|n8ndb|n8nkey)-[0-9TZ-]+-[a-f0-9]{8}\.json$/.test(name))
      continue;
    const receipt = path.join(directory, name);
    if (fs.lstatSync(receipt).isSymbolicLink())
      throw Error("Receipt must not redirect");
    const e = JSON.parse(fs.readFileSync(receipt, "utf8"));
    if (
      e.target !== name.split("-")[0] ||
      e.encryptedFile !== name.replace(/\.json$/, ".enc") ||
      e.project !== "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f" ||
      e.environment !== "692d14bf-022f-4bb5-9f14-702f8ee8b606" ||
      e.cipher !== "AES-256-GCM" ||
      !/^[a-f0-9]{64}$/i.test(e.encryptedSha256) ||
      !e.authenticated
    )
      throw Error("Unexpected backup receipt");
    const artifact = path.join(directory, e.encryptedFile);
    if (
      fs.lstatSync(artifact).isSymbolicLink() ||
      !fs.statSync(artifact).isFile()
    )
      throw Error("Invalid encrypted artifact");
    entries.push({ ...e, receipt, artifact });
  }
  const plan = planRetention(entries),
    apply = process.argv.includes("--apply");
  if (apply && plan.remove.length) {
    const key = fs.readFileSync(
      path.join(root, ".cache/recovery-keys/backup-aes256.key"),
    );
    // Reauthenticate both every planned deletion and the newest protected backup for each target before deleting anything.
    const newest = ["appdb", "n8ndb", "n8nkey"].flatMap((t) =>
      plan.keep
        .filter((e) => e.target === t)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, 3),
    );
    for (const e of [...newest, ...plan.remove]) {
      const hash = crypto.createHash("sha256");
      for await (const c of fs.createReadStream(e.artifact)) hash.update(c);
      if (hash.digest("hex") !== e.encryptedSha256)
        throw Error("Encrypted checksum mismatch; nothing deleted");
      await authenticateBackup(
        e.artifact,
        key,
        Buffer.from(e.target === "n8nkey" ? "{" : "PGDMP"),
      );
    }
    for (const e of plan.remove) {
      fs.unlinkSync(e.artifact);
      fs.unlinkSync(e.receipt);
      fs.appendFileSync(
        path.join(directory, "retention-audit.ndjson"),
        JSON.stringify({
          at: new Date().toISOString(),
          target: e.target,
          encryptedFile: e.encryptedFile,
          action: "expired-encrypted-backup-deleted",
        }) + "\n",
        { mode: 0o600 },
      );
    }
  }
  console.log(
    JSON.stringify({
      dryRun: !apply,
      days: plan.days,
      protected: plan.keep.length,
      candidates: plan.remove.map((e) => e.encryptedFile),
      deleted: apply ? plan.remove.length : 0,
      excluded:
        "recovery keys, transfer archives, offsite storage and restored databases",
    }),
  );
}
main().catch((e) => {
  console.error("Backup retention stopped: " + e.message);
  process.exitCode = 1;
});

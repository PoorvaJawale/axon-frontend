/* eslint-disable @typescript-eslint/no-require-imports */
// Minimal encrypted deletion receipts survive restoration of an older application database.
const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto"),
  { Readable } = require("stream");
const {
  encryptToFile,
  authenticateBackup,
  decryptStream,
} = require("./backup-crypto.cjs");
const validId = (x) =>
  typeof x === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x);
function validate(r) {
  if (
    r?.version !== 1 ||
    r.kind !== "account-deletion" ||
    !validId(r.requestId) ||
    typeof r.userId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(r.userId) ||
    !Number.isFinite(Date.parse(r.recordedAt))
  )
    throw Error("Invalid encrypted deletion receipt");
  return r;
}
async function readOne(file, key) {
  if (fs.lstatSync(file).isSymbolicLink() || fs.statSync(file).size > 16384)
    throw Error("Unsafe deletion receipt");
  await authenticateBackup(file, key, Buffer.from("{"));
  const chunks = [];
  for await (const c of decryptStream(file, key)) chunks.push(c);
  return validate(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}
async function writeTombstone(record, { directory, key }) {
  validate(record);
  if (!Buffer.isBuffer(key) || key.length !== 32)
    throw Error("Deletion recovery key is required");
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (
    fs.lstatSync(directory).isSymbolicLink() ||
    fs.realpathSync(directory).toLowerCase() !==
      path.resolve(directory).toLowerCase()
  )
    throw Error("Deletion ledger must not redirect");
  const file = path.join(
    directory,
    "privacy-delete-" + record.requestId + ".enc",
  );
  if (fs.existsSync(file)) {
    const prior = await readOne(file, key);
    if (prior.requestId !== record.requestId || prior.userId !== record.userId)
      throw Error("Deletion receipt ownership mismatch");
    return;
  }
  const temporary = file + ".partial-" + crypto.randomBytes(8).toString("hex");
  try {
    await encryptToFile(
      Readable.from([Buffer.from(JSON.stringify(record))]),
      temporary,
      key,
    );
    await authenticateBackup(temporary, key, Buffer.from("{"));
    try {
      fs.linkSync(temporary, file);
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      const prior = await readOne(file, key);
      if (prior.userId !== record.userId)
        throw Error("Deletion receipt ownership mismatch");
    }
    const fd = fs.openSync(file, "r+");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
async function readTombstones({ directory, key }) {
  if (!fs.existsSync(directory))
    throw Error(
      "Deletion recovery ledger is missing; operator review is required",
    );
  if (
    fs.lstatSync(directory).isSymbolicLink() ||
    fs.realpathSync(directory).toLowerCase() !==
      path.resolve(directory).toLowerCase()
  )
    throw Error("Deletion ledger must not redirect");
  const out = [];
  for (const name of fs.readdirSync(directory)) {
    if (name.includes(".partial-")) continue;
    if (!/^privacy-delete-[a-f0-9-]{36}\.enc$/i.test(name))
      throw Error("Unexpected deletion ledger artifact");
    out.push(await readOne(path.join(directory, name), key));
  }
  return out;
}
function operatorStore() {
  const root = path.resolve(__dirname, "../..");
  if (root.toLowerCase() !== "d:\\axon-frontend")
    throw Error("Run privacy recovery operations in the approved D: workspace");
  return {
    directory: path.join(root, ".cache/production-backups/privacy-tombstones"),
    key: fs.readFileSync(
      path.join(root, ".cache/recovery-keys/backup-aes256.key"),
    ),
  };
}
async function writeOperatorTombstone({ requestId, userId }) {
  return writeTombstone(
    {
      version: 1,
      kind: "account-deletion",
      requestId,
      userId,
      recordedAt: new Date().toISOString(),
    },
    operatorStore(),
  );
}
async function assertRecoveryClean(records, lookup) {
  const ids = [...new Set(records.map((r) => validate(r).userId))];
  if (ids.length && (await lookup(ids)))
    throw Error(
      "Restored data contains previously deleted accounts; keep recovery offline and reconcile deletions before activation",
    );
  return { tombstones: records.length, deletedUsers: ids.length, clean: true };
}
module.exports = {
  writeTombstone,
  readTombstones,
  operatorStore,
  writeOperatorTombstone,
  assertRecoveryClean,
};

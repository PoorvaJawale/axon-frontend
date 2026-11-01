/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const {
  encryptToFile,
  authenticateBackup,
} = require("../backend/operations/backup-crypto.cjs");
test("backup authentication rejects wrong keys and corrupted headers, ciphertext and tags before restore", async () => {
  const directory = path.resolve(
    ".cache/backup-crypto-test-" + crypto.randomUUID(),
  );
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "fixture.enc");
  const key = crypto.randomBytes(32);
  const body = Buffer.concat([Buffer.from("PGDMP"), crypto.randomBytes(4096)]);
  try {
    await encryptToFile(
      Readable.from([body.subarray(0, 7), body.subarray(7)]),
      file,
      key,
    );
    assert.equal(
      await authenticateBackup(file, key, Buffer.from("PGDMP")),
      body.length,
    );
    await assert.rejects(
      authenticateBackup(file, crypto.randomBytes(32), Buffer.from("PGDMP")),
    );
    const original = fs.readFileSync(file);
    for (const offset of [0, 25, original.length - 1]) {
      const corrupt = Buffer.from(original);
      corrupt[offset] ^= 1;
      fs.writeFileSync(file, corrupt);
      await assert.rejects(authenticateBackup(file, key, Buffer.from("PGDMP")));
    }
    fs.writeFileSync(file, original);
    await assert.rejects(authenticateBackup(file, key, Buffer.from("WRONG")));
  } finally {
    fs.rmSync(file, { force: true });
    fs.rmdirSync(directory);
  }
});

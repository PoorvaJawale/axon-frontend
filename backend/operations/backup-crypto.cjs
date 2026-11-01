/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const crypto = require("node:crypto");
const { pipeline, finished } = require("node:stream/promises");
const MAGIC = Buffer.from("AXONBK1\n");
async function encryptToFile(source, destination, key) {
  if (key.length !== 32) throw Error("Backup key must contain 32 bytes");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(MAGIC);
  const output = fs.createWriteStream(destination, {
    flags: "wx",
    mode: 0o600,
  });
  output.write(Buffer.concat([MAGIC, iv]));
  await pipeline(source, cipher, output, { end: false });
  output.end(cipher.getAuthTag());
  await finished(output);
}
function decryptStream(file, key) {
  const size = fs.statSync(file).size;
  if (size < MAGIC.length + 12 + 16) throw Error("Truncated encrypted backup");
  const fd = fs.openSync(file, "r");
  const header = Buffer.alloc(MAGIC.length + 12);
  const tag = Buffer.alloc(16);
  try {
    fs.readSync(fd, header, 0, header.length, 0);
    fs.readSync(fd, tag, 0, 16, size - 16);
  } finally {
    fs.closeSync(fd);
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC))
    throw Error("Unrecognized encrypted backup format");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    header.subarray(MAGIC.length),
  );
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  const source = fs.createReadStream(file, {
    start: header.length,
    end: size - 17,
  });
  source.on("error", (error) => decipher.destroy(error));
  return source.pipe(decipher);
}
async function authenticateBackup(file, key, expectedPrefix) {
  let prefix = Buffer.alloc(0),
    bytes = 0;
  // Authenticate the entire artifact BEFORE sending a second decrypted pass to pg_restore.
  for await (const chunk of decryptStream(file, key)) {
    bytes += chunk.length;
    if (prefix.length < expectedPrefix.length)
      prefix = Buffer.concat([prefix, chunk]).subarray(
        0,
        expectedPrefix.length,
      );
  }
  if (!prefix.equals(expectedPrefix))
    throw Error("Decrypted backup has an unexpected payload type");
  return bytes;
}
module.exports = { encryptToFile, decryptStream, authenticateBackup };

/* eslint-disable @typescript-eslint/no-require-imports */
// Operator-only export. Does not print account data or secret values.
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
async function main() {
  const [id, target] = process.argv.slice(2);
  if (!/^[a-f0-9-]{36}$/i.test(id || "") || !target || !path.isAbsolute(target))
    throw Error(
      "Usage: node scripts/privacy-export.cjs <request-uuid> <absolute-encrypted-output-path>",
    );
  const relative = path.relative(process.cwd(), target);
  if (!relative.startsWith("..") && !path.isAbsolute(relative))
    throw Error("Keep personal-data exports outside the repository.");
  const key = process.env.AXON_EXPORT_KEY;
  if (!/^[a-f0-9]{64}$/i.test(key || ""))
    throw Error(
      "Set AXON_EXPORT_KEY to a securely held 32-byte hex encryption key.",
    );
  const connection = process.env.AXON_DATABASE_URL;
  if (
    !connection ||
    new URL(connection).searchParams.get("sslmode") !== "verify-full"
  )
    throw Error(
      "Configure the dedicated verified-TLS database URL explicitly.",
    );
  const pool = new Pool({
    connectionString: process.env.AXON_DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
  const db = await pool.connect();
  let fd;
  try {
    const r = (
      await db.query(
        "SELECT * FROM axon_security.privacy_requests WHERE id=$1 AND kind='export' AND state IN ('pending','processing')",
        [id],
      )
    ).rows[0];
    if (!r) throw Error("No pending export request.");
    await db.query(
      "UPDATE axon_security.privacy_requests SET state='processing' WHERE id=$1",
      [id],
    );
    const iv = crypto.randomBytes(12),
      cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(key, "hex"),
        iv,
      );
    fd = fs.openSync(target, "wx", 0o600);
    fs.writeSync(fd, Buffer.from("AXON1"));
    fs.writeSync(fd, iv);
    let bytes = 0;
    const write = (text) => {
      bytes += Buffer.byteLength(text);
      if (bytes > 100 * 1024 * 1024)
        throw Error(
          "Export exceeded 100MiB; use a reviewed streaming bulk export.",
        );
      fs.writeSync(fd, cipher.update(text, "utf8"));
    };
    await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    write(
      '{"scope":"Axon application database only; identity, payment-provider and support records require separate collection","tables":{',
    );
    let first = true;
    const tables = {
      quota: "SELECT * FROM public.axon_account_quota WHERE user_id=$1",
      keys: "SELECT id,name,key_prefix,plan,is_active,created_at,updated_at,last_used_at,expires_at FROM public.api_keys WHERE user_id=$1",
      logs: "SELECT id,timestamp,agent_id,action_type,schema_result,semantic_result,final_verdict,reason,raw_output FROM public.validation_logs WHERE user_id=$1",
      reviews: "SELECT * FROM axon_security.alert_reviews WHERE user_id=$1",
      destinations:
        "SELECT url,verified_at,created_at FROM axon_security.callback_destinations WHERE user_id=$1",
      requests:
        "SELECT id,kind,state,created_at,completed_at FROM axon_security.privacy_requests WHERE user_id=$1",
    };
    for (const [name, sql] of Object.entries(tables)) {
      if (!first) write(",");
      first = false;
      write(JSON.stringify(name) + ":[");
      await db.query("DECLARE export_rows NO SCROLL CURSOR FOR " + sql, [
        r.user_id,
      ]);
      let separator = false;
      for (;;) {
        const rows = (await db.query("FETCH 500 FROM export_rows")).rows;
        if (!rows.length) break;
        for (const row of rows) {
          if (separator) write(",");
          separator = true;
          write(JSON.stringify(row));
        }
      }
      await db.query("CLOSE export_rows");
      write("]");
    }
    write("}}");
    await db.query("COMMIT");
    fs.writeSync(fd, cipher.final());
    fs.writeSync(fd, cipher.getAuthTag());
    fs.closeSync(fd);
    fd = undefined;
    console.log(
      "Encrypted application-data export written. Request remains processing until provider/support records are collected and delivered securely. File format: AXON1 + 12-byte IV + AES-256-GCM ciphertext + 16-byte authentication tag.",
    );
  } catch (error) {
    await db.query("ROLLBACK").catch(() => {});
    if (fd !== undefined) fs.closeSync(fd);
    throw error;
  } finally {
    db.release();
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

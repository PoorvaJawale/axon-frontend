/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const exe = path.join(
  process.env.APPDATA,
  "npm/node_modules/@railway/cli/bin/railway.exe",
);
function sql(input) {
  const result = spawnSync(
    exe,
    [
      "ssh",
      "--project",
      "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f",
      "--environment",
      "692d14bf-022f-4bb5-9f14-702f8ee8b606",
      "--service",
      "34c598c5-2293-4024-baeb-0b48a9b78677",
      "--",
      'psql -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -qAt',
    ],
    {
      input,
      encoding: "utf8",
      timeout: 120_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    },
  );
  if (result.error || result.status !== 0)
    throw Error(
      "Production SQL failed; transaction rolled back if uncommitted. Raw output withheld. Inspect before retrying.",
    );
  return result.stdout.trim();
}
function migrate() {
  const backups = path.join(root, ".cache/production-backups");
  const latest = fs
    .readdirSync(backups)
    .filter((x) => x.startsWith("appdb-") && x.endsWith(".json"))
    .sort()
    .at(-1);
  const meta =
    latest && JSON.parse(fs.readFileSync(path.join(backups, latest), "utf8"));
  if (
    !meta?.authenticated ||
    Date.now() - fs.statSync(path.join(backups, latest)).mtimeMs > 30 * 60_000
  )
    throw Error("A fresh authenticated application backup is required.");
  const files = fs
    .readdirSync(path.join(root, "backend/migrations"))
    .filter((x) => /^00[1-5]_.*\.sql$/.test(x))
    .sort();
  if (files.length !== 5)
    throw Error("Expected exactly five reviewed migrations");
  const texts = files.map((x) =>
    fs.readFileSync(path.join(root, "backend/migrations", x), "utf8"),
  );
  texts.push(
    fs.readFileSync(path.join(root, "backend/deployment/grants.sql"), "utf8"),
  );
  const body = texts
    .map((x) => x.replace(/^\s*(BEGIN|COMMIT);\s*$/gim, ""))
    .join("\n");
  const output = sql(`BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
LOCK TABLE public.api_keys,public.axon_account_quota,public.validation_logs IN SHARE MODE;
CREATE TEMP TABLE axon_before ON COMMIT DROP AS SELECT
 (SELECT md5(COALESCE(string_agg(row_to_json(k)::text,chr(10) ORDER BY id),'')) FROM public.api_keys k) keys,
 (SELECT md5(COALESCE(string_agg(row_to_json(q)::text,chr(10) ORDER BY user_id),'')) FROM public.axon_account_quota q) quotas,
 (SELECT count(*) FROM public.validation_logs) logs;
${body}
DO $$ BEGIN
 IF (SELECT keys FROM axon_before) IS DISTINCT FROM (SELECT md5(COALESCE(string_agg(row_to_json(k)::text,chr(10) ORDER BY id),'')) FROM public.api_keys k) THEN RAISE EXCEPTION 'Key rows changed'; END IF;
 IF (SELECT quotas FROM axon_before) IS DISTINCT FROM (SELECT md5(COALESCE(string_agg(row_to_json(q)::text,chr(10) ORDER BY user_id),'')) FROM public.axon_account_quota q) THEN RAISE EXCEPTION 'Quota rows changed'; END IF;
 IF (SELECT logs FROM axon_before) <> (SELECT count(*) FROM public.validation_logs) THEN RAISE EXCEPTION 'Log count changed'; END IF;
 IF has_column_privilege('axon_web','public.axon_account_quota','free_used','UPDATE') OR has_function_privilege('axon_validator','public.axon_apply_billing(text,text,timestamptz,timestamptz,timestamptz,bigint)','EXECUTE') THEN RAISE EXCEPTION 'Role boundary failure'; END IF;
END $$;
COMMIT;
SELECT json_build_object('accounts',(SELECT count(*) FROM public.axon_account_quota),'keys',(SELECT count(*) FROM public.api_keys),'logs',(SELECT count(*) FROM public.validation_logs),'existingRowsPreserved',true,'roleBoundariesVerified',true);
`);
  const result = JSON.parse(output.split(/\r?\n/).at(-1));
  const dir = path.join(root, ".cache/production-deployment");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "database-migration.json"),
    JSON.stringify(
      {
        ...result,
        at: new Date().toISOString(),
        files,
        sqlSha256: crypto.createHash("sha256").update(body).digest("hex"),
        backupMetadata: latest,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(JSON.stringify(result));
}
function scram(password) {
  const salt = crypto.randomBytes(16);
  const salted = crypto.pbkdf2Sync(password, salt, 4096, 32, "sha256");
  const stored = crypto
    .createHash("sha256")
    .update(crypto.createHmac("sha256", salted).update("Client Key").digest())
    .digest("base64");
  const server = crypto
    .createHmac("sha256", salted)
    .update("Server Key")
    .digest("base64");
  return `SCRAM-SHA-256$4096:${salt.toString("base64")}$${stored}:${server}`;
}
async function logins() {
  const dir = path.join(root, ".cache/production-deployment");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(root, ".cache/recovery-keys/database-logins.json");
  const existing = Number(
    sql(
      "SELECT count(*) FROM pg_roles WHERE rolname IN ('axon_control','axon_validation');",
    ),
  );
  if (existing !== 0 && existing !== 2)
    throw Error("Partial existing login setup; reconcile manually.");
  if (existing && !fs.existsSync(file))
    throw Error(
      "Existing logins lack local recovery record; do not rotate blindly.",
    );
  if (!fs.existsSync(file))
    fs.writeFileSync(
      file,
      JSON.stringify({
        axon_control: crypto.randomBytes(32).toString("hex"),
        axon_validation: crypto.randomBytes(32).toString("hex"),
      }),
      { flag: "wx", mode: 0o600 },
    );
  const passwords = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Object.values(passwords).every((x) => /^[a-f0-9]{64}$/.test(x)))
    throw Error("Invalid login recovery record");
  if (!existing)
    sql(`BEGIN;
CREATE ROLE axon_control LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 12 PASSWORD '${scram(passwords.axon_control)}';
CREATE ROLE axon_validation LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 8 PASSWORD '${scram(passwords.axon_validation)}';
GRANT axon_web TO axon_control; GRANT axon_validator TO axon_validation;
GRANT CONNECT ON DATABASE railway TO axon_control,axon_validation;
COMMIT;`);
  const caResult = spawnSync(
    exe,
    [
      "ssh",
      "--project",
      "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f",
      "--environment",
      "692d14bf-022f-4bb5-9f14-702f8ee8b606",
      "--service",
      "34c598c5-2293-4024-baeb-0b48a9b78677",
      "--",
      "cat /var/lib/postgresql/data/certs/root.crt",
    ],
    { encoding: "utf8", timeout: 60_000, windowsHide: true },
  );
  const ca = caResult.stdout?.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
  )?.[0];
  if (caResult.status !== 0 || !ca) throw Error("Public CA retrieval failed");
  fs.writeFileSync(path.join(dir, "application-ca.pem"), ca + "\n");
  const { Client } = require("pg");
  const verified = [];
  for (const user of ["axon_control", "axon_validation"]) {
    const client = new Client({
      host: "tokaido.proxy.rlwy.net",
      port: 58700,
      database: "railway",
      user,
      password: passwords[user],
      ssl: { ca, rejectUnauthorized: true },
      connectionTimeoutMillis: 10_000,
      statement_timeout: 10_000,
    });
    try {
      await client.connect();
      const result = (
        await client.query(
          "SELECT current_user AS identity,ssl,version FROM pg_stat_ssl WHERE pid=pg_backend_pid()",
        )
      ).rows[0];
      if (result?.identity !== user || result.ssl !== true)
        throw Error("Verified-TLS identity check failed");
      const boundary = (
        await client.query(
          "SELECT has_column_privilege(current_user,'public.axon_account_quota','free_used','UPDATE') AS can_reset_free,has_function_privilege(current_user,'public.axon_apply_billing(text,text,timestamptz,timestamptz,timestamptz,bigint)','EXECUTE') AS can_bill",
        )
      ).rows[0];
      if (
        user === "axon_control"
          ? boundary.can_reset_free || !boundary.can_bill
          : !boundary.can_reset_free || boundary.can_bill
      )
        throw Error("Login role boundary failure");
      verified.push(result);
    } finally {
      await client.end();
    }
  }
  const url = new URL(
    "postgresql://tokaido.proxy.rlwy.net:58700/railway?sslmode=verify-full",
  );
  url.username = "axon_control";
  url.password = passwords.axon_control;
  fs.writeFileSync(
    path.join(dir, "frontend-database.env"),
    "AXON_DATABASE_URL=" + url.toString() + "\n",
    { mode: 0o600 },
  );
  fs.writeFileSync(
    path.join(dir, "login-verification.json"),
    JSON.stringify({ at: new Date().toISOString(), verified }, null, 2) + "\n",
  );
  console.log(JSON.stringify({ verified, secretsPrinted: false }));
}
async function main() {
  if (process.argv[2] === "migrate") migrate();
  else if (process.argv[2] === "logins") await logins();
  else throw Error("Use migrate or logins");
}
main().catch(() => {
  console.error(
    "Database operation failed; raw output withheld. Stop and inspect the operator receipt before retrying.",
  );
  process.exitCode = 1;
});

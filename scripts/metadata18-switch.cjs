/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  dir = path.join(root, ".cache/production-deployment"),
  exe = path.join(
    process.env.APPDATA,
    "npm/node_modules/@railway/cli/bin/railway.exe",
  ),
  project = "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f",
  environment = "692d14bf-022f-4bb5-9f14-702f8ee8b606",
  target = "af53601a-765e-4d4e-b855-641f803d757c",
  main = "7e26464d-ff3f-4aa0-9d9b-b1dff1a28fa9";
function run(args, input) {
  const r = spawnSync(exe, args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (r.status !== 0)
    throw Error(
      "Metadata switch operation failed; raw provider output withheld",
    );
  return r.stdout.trim();
}
function scram(password) {
  const salt = crypto.randomBytes(16),
    salted = crypto.pbkdf2Sync(password, salt, 4096, 32, "sha256"),
    stored = crypto
      .createHash("sha256")
      .update(crypto.createHmac("sha256", salted).update("Client Key").digest())
      .digest("base64"),
    server = crypto
      .createHmac("sha256", salted)
      .update("Server Key")
      .digest("base64");
  return `SCRAM-SHA-256$4096:${salt.toString("base64")}$${stored}:${server}`;
}
function mainFn() {
  const transferred = JSON.parse(
    fs.readFileSync(path.join(dir, "metadata18-transfer.json"), "utf8"),
  );
  if (transferred.result.active !== 4)
    throw Error("Verified replacement required");
  const receipt = path.join(dir, "metadata18-switch.json");
  if (fs.existsSync(receipt))
    throw Error("Switch already attempted; inspect before retrying");
  const keyFile = path.join(
    root,
    ".cache/recovery-keys/metadata18-n8n-password",
  );
  if (!fs.existsSync(keyFile))
    fs.writeFileSync(keyFile, crypto.randomBytes(32).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  const password = fs.readFileSync(keyFile, "utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(password)) throw Error("Invalid new login record");
  const sql = `BEGIN;
CREATE ROLE axon_n8n LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 8 PASSWORD '${scram(password)}';
ALTER DATABASE railway OWNER TO axon_n8n;
ALTER SCHEMA public OWNER TO axon_n8n;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT c.relname,c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m') ORDER BY CASE WHEN c.relkind='S' THEN 1 ELSE 0 END LOOP
 EXECUTE format('ALTER %s public.%I OWNER TO axon_n8n',CASE WHEN r.relkind='S' THEN 'SEQUENCE' WHEN r.relkind='v' THEN 'VIEW' WHEN r.relkind='m' THEN 'MATERIALIZED VIEW' ELSE 'TABLE' END,r.relname);END LOOP;
 FOR r IN SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e' LOOP EXECUTE format('ALTER TYPE public.%I OWNER TO axon_n8n',r.typname);END LOOP;
END $$;
COMMIT;`;
  run(
    [
      "ssh",
      "--project",
      project,
      "--environment",
      environment,
      "--service",
      target,
      "--",
      'psql -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 -q',
    ],
    sql,
  );
  const output = run([
      "ssh",
      "--project",
      project,
      "--environment",
      environment,
      "--service",
      target,
      "--",
      "cat /var/lib/postgresql/data/certs/root.crt",
    ]),
    ca = output.match(
      /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
    )?.[0];
  if (!ca) throw Error("Replacement CA missing");
  fs.writeFileSync(path.join(dir, "metadata18-ca.pem"), ca + "\n");
  const vars = {
    DB_POSTGRESDB_HOST: "axon-n8n-metadata18.railway.internal",
    DB_POSTGRESDB_PORT: "5432",
    DB_POSTGRESDB_DATABASE: "railway",
    DB_POSTGRESDB_USER: "axon_n8n",
    DB_POSTGRESDB_PASSWORD: password,
    DB_POSTGRESDB_SSL_ENABLED: "true",
    DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED: "true",
    DB_POSTGRESDB_SSL_CA: ca,
  };
  fs.writeFileSync(
    receipt,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        state: "prepared",
        target,
        oldService: "8903014e-6048-4f1f-b792-c5f8045b177a",
        oldDatabaseRetained: true,
        names: Object.keys(vars),
      },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  const response = JSON.parse(
    run(
      [
        "api",
        "mutation Metadata18Switch($input:VariableCollectionUpsertInput!){variableCollectionUpsert(input:$input)}",
        "--variables",
        "@-",
      ],
      JSON.stringify({
        input: {
          projectId: project,
          environmentId: environment,
          serviceId: main,
          replace: false,
          skipDeploys: true,
          variables: vars,
        },
      }),
    ),
  );
  if (response.errors || response.data?.variableCollectionUpsert !== true)
    throw Error("Replacement connection settings rejected");
  const deployment = JSON.parse(
    run([
      "service",
      "redeploy",
      "--project",
      project,
      "--environment",
      environment,
      "--service",
      main,
      "--yes",
      "--json",
    ]),
  );
  fs.writeFileSync(
    receipt,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        state: "deploying",
        target,
        oldService: "8903014e-6048-4f1f-b792-c5f8045b177a",
        oldDatabaseRetained: true,
        mainEncryptionKeyUnchanged: true,
        deployment,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({
      state: "deploying",
      target,
      oldDatabaseRetained: true,
      mainEncryptionKeyUnchanged: true,
      deployment,
    }),
  );
}
try {
  mainFn();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}

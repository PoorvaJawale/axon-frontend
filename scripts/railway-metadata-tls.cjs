/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const exe = path.join(
  process.env.APPDATA,
  "npm/node_modules/@railway/cli/bin/railway.exe",
);
const project = "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f",
  environment = "692d14bf-022f-4bb5-9f14-702f8ee8b606",
  service = "7e26464d-ff3f-4aa0-9d9b-b1dff1a28fa9";
function run(args, input) {
  const r = spawnSync(exe, args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 90_000,
    maxBuffer: 1024 * 1024,
  });
  if (r.status !== 0)
    throw Error("Railway TLS operation failed; raw output withheld");
  return r.stdout;
}
function main() {
  const dir = path.join(root, ".cache/production-deployment");
  const file = path.join(dir, "metadata-tls-settings.json");
  if (fs.existsSync(file))
    throw Error("Metadata TLS already attempted; inspect before retrying");
  const output = run([
    "ssh",
    "--project",
    project,
    "--environment",
    environment,
    "--service",
    "8903014e-6048-4f1f-b792-c5f8045b177a",
    "--",
    "cat /var/lib/postgresql/data/certs/root.crt",
  ]);
  const ca = output.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/,
  )?.[0];
  if (!ca) throw Error("Public metadata CA missing");
  fs.writeFileSync(path.join(dir, "metadata-ca.pem"), ca + "\n");
  const all = JSON.parse(
    run([
      "variable",
      "list",
      "--project",
      project,
      "--environment",
      environment,
      "--service",
      service,
      "--json",
    ]),
  );
  const variables = {
    DB_POSTGRESDB_HOST: "postgres.railway.internal",
    DB_POSTGRESDB_PORT: "5432",
    DB_POSTGRESDB_SSL_ENABLED: "true",
    DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED: "true",
    DB_POSTGRESDB_SSL_CA: ca,
  };
  const previous = {};
  for (const key of Object.keys(variables)) previous[key] = all[key] ?? null;
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        previous,
        names: Object.keys(variables),
        applied: false,
      },
      null,
      2,
    ) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  const response = JSON.parse(
    run(
      [
        "api",
        "mutation MetadataTls($input:VariableCollectionUpsertInput!){variableCollectionUpsert(input:$input)}",
        "--variables",
        "@-",
      ],
      JSON.stringify({
        input: {
          projectId: project,
          environmentId: environment,
          serviceId: service,
          replace: false,
          skipDeploys: true,
          variables,
        },
      }),
    ),
  );
  if (response.errors || response.data?.variableCollectionUpsert !== true)
    throw Error("Metadata TLS settings rejected");
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        previous,
        names: Object.keys(variables),
        applied: true,
        restartRequired: true,
      },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
  console.log(
    "Metadata database private routing and verified TLS configured. Credentials unchanged; controlled restart required.",
  );
}
try {
  main();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}

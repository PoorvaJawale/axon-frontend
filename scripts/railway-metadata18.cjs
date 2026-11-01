/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  dir = path.join(root, ".cache/production-deployment"),
  file = path.join(dir, "metadata18.json");
const exe = path.join(
    process.env.APPDATA,
    "npm/node_modules/@railway/cli/bin/railway.exe",
  ),
  project = "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f",
  environment = "692d14bf-022f-4bb5-9f14-702f8ee8b606";
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
      "Metadata replacement operation failed; raw provider output withheld",
    );
  return JSON.parse(r.stdout);
}
function main() {
  if (process.argv[2] !== "provision")
    throw Error("Use provision after explicit resource/data approval");
  const recovered = JSON.parse(
    fs.readFileSync(
      path.join(root, ".cache/recovery/n8n18-restore-result.json"),
      "utf8",
    ),
  );
  if (
    !recovered.offline ||
    !recovered.n8nCliCompatible ||
    recovered.counts.active !== 4
  )
    throw Error("Offline metadata restore/compatibility evidence required");
  const status = run([
    "status",
    "--project",
    project,
    "--environment",
    environment,
    "--json",
  ]);
  const existing = status.services.edges
    .map((x) => x.node)
    .filter((x) => x.name === "axon-n8n-metadata18");
  if (existing.length > 1) throw Error("Ambiguous replacement service");
  const secretFile = path.join(
    root,
    ".cache/recovery-keys/metadata18-db-password",
  );
  if (existing.length && !fs.existsSync(secretFile))
    throw Error(
      "Existing replacement without local recovery password; do not rotate blindly",
    );
  if (!fs.existsSync(secretFile))
    fs.writeFileSync(secretFile, crypto.randomBytes(32).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  const password = fs.readFileSync(secretFile, "utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(password))
    throw Error("Unexpected new password record");
  const app = status.environments.edges
    .flatMap((x) => x.node.serviceInstances.edges.map((y) => y.node))
    .find((x) => x.serviceId === "34c598c5-2293-4024-baeb-0b48a9b78677");
  const digest = app?.latestDeployment?.meta?.imageDigest;
  if (!/^sha256:[a-f0-9]{64}$/.test(digest))
    throw Error("Verified app PostgreSQL image digest unavailable");
  const image = "ghcr.io/railwayapp-templates/postgres-ssl@" + digest;
  let service = existing[0];
  if (!service) {
    const input = {
      projectId: project,
      environmentId: environment,
      name: "axon-n8n-metadata18",
      variables: {
        POSTGRES_DB: "railway",
        POSTGRES_USER: "postgres",
        POSTGRES_PASSWORD: password,
        PGDATABASE: "railway",
        PGUSER: "postgres",
        PGPASSWORD: password,
        PGPORT: "5432",
        PGDATA: "/var/lib/postgresql/data/pgdata",
      },
    };
    const r = run(
      [
        "api",
        "mutation Metadata18($input:ServiceCreateInput!){serviceCreate(input:$input){id name}}",
        "--variables",
        "@-",
      ],
      JSON.stringify({ input }),
    );
    service = r.data?.serviceCreate;
    if (!service?.id) throw Error("Replacement service creation not confirmed");
  }
  const volumes = status.environments.edges
    .flatMap((x) => x.node.volumeInstances.edges.map((y) => y.node))
    .filter((x) => x.serviceId === service.id);
  let volumeId = volumes[0]?.volume?.id;
  if (!volumeId) {
    const r = run(
      [
        "api",
        "mutation MetadataVolume($input:VolumeCreateInput!){volumeCreate(input:$input){id name}}",
        "--variables",
        "@-",
      ],
      JSON.stringify({
        input: {
          projectId: project,
          environmentId: environment,
          serviceId: service.id,
          mountPath: "/var/lib/postgresql/data",
          region: "sfo",
        },
      }),
    );
    volumeId = r.data?.volumeCreate?.id;
    if (!volumeId) throw Error("Replacement volume creation not confirmed");
  }
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        project,
        environment,
        serviceId: service.id,
        serviceName: service.name,
        volumeId,
        image,
        privateHost: "axon-n8n-metadata18.railway.internal",
        state: "provisioned",
        n8nSwitched: false,
      },
      null,
      2,
    ) + "\n",
  );
  run([
    "service",
    "source",
    "connect",
    "--project",
    project,
    "--environment",
    environment,
    "--service",
    service.id,
    "--image",
    image,
    "--json",
  ]);
  console.log(
    JSON.stringify({
      serviceId: service.id,
      volumeId,
      image,
      n8nSwitched: false,
    }),
  );
}
try {
  main();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}

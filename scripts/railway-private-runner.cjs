/* eslint-disable @typescript-eslint/no-require-imports */
// Operator helper: provisions only the approved private runner; never changes n8n.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const project = "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f";
const environment = "692d14bf-022f-4bb5-9f14-702f8ee8b606";
const name = "axon-private-runner";
const exe = path.join(
  process.env.APPDATA,
  "npm/node_modules/@railway/cli/bin/railway.exe",
);
function run(args, input) {
  const result = spawnSync(exe, args, {
    cwd: root,
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw Error(
      "Railway operation failed; raw provider output withheld to protect configuration.",
    );
  return JSON.parse(result.stdout);
}
function main() {
  if (process.argv[2] === "connect") {
    const directory = path.join(root, ".cache/production-deployment");
    if (!fs.existsSync(path.join(directory, "inactive-workflows.json")))
      throw Error(
        "Inactive candidates/native credential must be prepared first",
      );
    const serviceId = "7e26464d-ff3f-4aa0-9d9b-b1dff1a28fa9";
    const originalFile = path.join(
      directory,
      "n8n-runner-previous-settings.json",
    );
    if (fs.existsSync(originalFile))
      throw Error(
        "Connection already attempted; inspect current state before retrying.",
      );
    const existing = run([
      "variable",
      "list",
      "--project",
      project,
      "--environment",
      environment,
      "--service",
      serviceId,
      "--json",
    ]);
    if (existing.N8N_RUNNERS_AUTH_TOKEN)
      throw Error(
        "Existing broker token requires explicit reconciliation; not overwritten.",
      );
    const variables = {
      N8N_RUNNERS_ENABLED: "true",
      N8N_RUNNERS_MODE: "external",
      N8N_RUNNERS_BROKER_LISTEN_ADDRESS: "0.0.0.0",
      N8N_RUNNERS_TASK_TIMEOUT: "120",
      NODE_EXTRA_CA_CERTS: "/home/node/.n8n/axon-trust/application-ca.pem",
      N8N_RUNNERS_AUTH_TOKEN: fs
        .readFileSync(
          path.join(root, ".cache/recovery-keys/runner-auth-token"),
          "utf8",
        )
        .trim(),
    };
    const previous = {};
    for (const key of Object.keys(variables))
      previous[key] = existing[key] ?? null;
    fs.writeFileSync(originalFile, JSON.stringify(previous, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    const response = run(
      [
        "api",
        "mutation ConnectRunner($input: VariableCollectionUpsertInput!) { variableCollectionUpsert(input: $input) }",
        "--variables",
        "@-",
      ],
      JSON.stringify({
        input: {
          projectId: project,
          environmentId: environment,
          serviceId,
          replace: false,
          skipDeploys: true,
          variables,
        },
      }),
    );
    if (response.errors || response.data?.variableCollectionUpsert !== true)
      throw Error("Runner settings rejected; inspect before retrying.");
    const deploy = run([
      "service",
      "redeploy",
      "--project",
      project,
      "--environment",
      environment,
      "--service",
      serviceId,
      "--yes",
      "--json",
    ]);
    console.log(
      JSON.stringify({
        settingsUpdated: Object.keys(variables),
        redeploy: deploy,
        legacyEnvironmentAccessUnchanged: true,
      }),
    );
    return;
  }
  if (process.argv[2] !== "provision")
    throw Error("Use provision only after owner resource approval.");
  const status = run([
    "status",
    "--project",
    project,
    "--environment",
    environment,
    "--json",
  ]);
  if (status.id !== project) throw Error("Unexpected project");
  const matches = status.services.edges
    .map((x) => x.node)
    .filter((x) => x.name === name);
  if (matches.length > 1) throw Error("Ambiguous runner service");
  const keyDir = path.join(root, ".cache/recovery-keys");
  fs.mkdirSync(keyDir, { recursive: true });
  const tokenFile = path.join(keyDir, "runner-auth-token");
  if (matches.length && !fs.existsSync(tokenFile))
    throw Error(
      "Existing runner without local token: reconcile manually, do not rotate blindly.",
    );
  if (!fs.existsSync(tokenFile))
    fs.writeFileSync(tokenFile, crypto.randomBytes(48).toString("hex"), {
      flag: "wx",
      mode: 0o600,
    });
  const token = fs.readFileSync(tokenFile, "utf8").trim();
  if (!/^[a-f0-9]{96}$/.test(token)) throw Error("Invalid runner token file");
  let service = matches[0];
  if (!service) {
    const input = {
      projectId: project,
      environmentId: environment,
      name,
      variables: {
        PORT: "5680",
        N8N_RUNNERS_TASK_BROKER_URI: "http://n8n.railway.internal:5679",
        N8N_RUNNERS_AUTH_TOKEN: token,
        N8N_RUNNERS_MAX_CONCURRENCY: "4",
        N8N_RUNNERS_TASK_TIMEOUT: "120",
        GENERIC_TIMEZONE: "Asia/Kolkata",
      },
    };
    const response = run(
      [
        "api",
        "mutation CreatePrivateRunner($input: ServiceCreateInput!) { serviceCreate(input: $input) { id name } }",
        "--variables",
        "@-",
      ],
      JSON.stringify({ input }),
    );
    if (response.errors)
      throw Error(
        "Service creation rejected; inspect metadata before retrying.",
      );
    service = response.data?.serviceCreate;
    if (!service?.id || service.name !== name)
      throw Error(
        "Unexpected service creation response; inspect before retrying.",
      );
  }
  const directory = path.join(root, ".cache/production-deployment");
  fs.mkdirSync(directory, { recursive: true });
  const receipt = {
    project,
    environment,
    serviceId: service.id,
    serviceName: name,
    brokerHost: "n8n.railway.internal",
    mainServiceChanged: false,
  };
  fs.writeFileSync(
    path.join(directory, "runner.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(JSON.stringify(receipt));
}
try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

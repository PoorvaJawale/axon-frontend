/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const local = path.join(root, ".cache/staging");
const state = path.join(local, "n8n");
const values = Object.fromEntries(
  fs
    .readFileSync(path.join(local, ".env"), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("=")),
);
const existing = JSON.parse(
  fs.readFileSync(path.join(state, "workflows-current.json"), "utf8"),
);
const dir = path.join(state, "staging-workflows");
fs.mkdirSync(dir, { recursive: true });
const credentialId = "axonLocalValidator";
fs.writeFileSync(
  path.join(state, "staging-credentials.json"),
  JSON.stringify(
    [
      {
        id: credentialId,
        name: "Axon LOCAL staging validator — no live access",
        type: "postgres",
        data: {
          host: "postgres",
          database: "axon_staging",
          user: "axon_staging_validator",
          password: values.STAGING_VALIDATOR_PASSWORD,
          port: 5432,
          ssl: "disable",
          allowUnauthorizedCerts: false,
          maxConnections: 3,
        },
      },
    ],
    null,
    2,
  ),
  { mode: 0o600 },
);
const ids = {};
for (const file of [
  "validationproject.hardened.json",
  "background-worker.hardened.json",
  "validation-status.hardened.json",
]) {
  const workflow = JSON.parse(
    fs.readFileSync(path.join(root, "backend/workflows", file), "utf8"),
  );
  const matches = existing.filter((w) => w.name === workflow.name);
  if (matches.length !== 1)
    throw new Error("Expected one already imported candidate: " + file);
  workflow.id = matches[0].id;
  workflow.active = false;
  for (const node of workflow.nodes)
    if (node.type === "n8n-nodes-base.postgres")
      node.credentials = {
        postgres: {
          id: credentialId,
          name: "Axon LOCAL staging validator — no live access",
        },
      };
  fs.writeFileSync(path.join(dir, file), JSON.stringify(workflow, null, 2));
  ids[file] = workflow.id;
}
const probePath = "axon-runtime-" + crypto.randomBytes(16).toString("hex");
const probe = {
  id: "axonRuntimeProbe",
  name: "Axon LOCAL runtime compatibility probe",
  active: false,
  nodes: [
    {
      id: "probe-webhook",
      name: "Probe",
      type: "n8n-nodes-base.webhook",
      typeVersion: 2,
      position: [0, 0],
      webhookId: "axon-runtime-probe",
      parameters: {
        httpMethod: "GET",
        path: probePath,
        responseMode: "responseNode",
        options: {},
      },
    },
    {
      id: "probe-code",
      name: "Check restricted modules",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [240, 0],
      parameters: {
        jsCode:
          "const c=require('crypto'), d=require('dns'), h=require('https'), u=require('url'); let denied=false;try{require('fs')}catch{denied=true} if(!denied||typeof d.lookup!=='function'||typeof h.request!=='function'||new u.URL('https://example.com').hostname!=='example.com'||c.createHash('sha256').update('probe').digest('hex').length!==64)throw Error('MODULE_POLICY_FAILED');return [{json:{modules_ok:true}}];",
      },
    },
    {
      id: "probe-db",
      name: "Check validator database",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.6,
      position: [480, 0],
      parameters: {
        operation: "executeQuery",
        query:
          "SELECT current_database() AS database, count(*)::integer AS account_count FROM public.axon_account_quota",
        options: {},
      },
      credentials: {
        postgres: {
          id: credentialId,
          name: "Axon LOCAL staging validator — no live access",
        },
      },
    },
    {
      id: "probe-response",
      name: "Probe response",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1.4,
      position: [720, 0],
      parameters: {
        respondWith: "json",
        responseBody:
          "={{ {ok: $json.database === 'axon_staging', account_count: $json.account_count} }}",
        options: { responseCode: 200 },
      },
    },
  ],
  connections: {
    Probe: {
      main: [[{ node: "Check restricted modules", type: "main", index: 0 }]],
    },
    "Check restricted modules": {
      main: [[{ node: "Check validator database", type: "main", index: 0 }]],
    },
    "Check validator database": {
      main: [[{ node: "Probe response", type: "main", index: 0 }]],
    },
  },
  settings: {
    executionOrder: "v1",
    saveDataSuccessExecution: "none",
    saveDataErrorExecution: "none",
    saveManualExecutions: false,
    executionTimeout: 120,
  },
};
fs.writeFileSync(
  path.join(state, "runtime-probe.json"),
  JSON.stringify(probe, null, 2),
);
fs.writeFileSync(
  path.join(local, "workflow-ids.json"),
  JSON.stringify({ ...ids, probeId: probe.id, probePath }, null, 2),
);
console.log(
  "Prepared three local credential-bound copies and a temporary compatibility probe. Tracked candidates and live configuration unchanged.",
);

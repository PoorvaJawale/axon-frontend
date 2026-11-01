/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  dir = path.join(root, ".cache/production-deployment");
const exe = path.join(
  process.env.APPDATA,
  "npm/node_modules/@railway/cli/bin/railway.exe",
);
const project = "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f",
  environment = "692d14bf-022f-4bb5-9f14-702f8ee8b606",
  service = "7e26464d-ff3f-4aa0-9d9b-b1dff1a28fa9";
const retired = [
  "36DFMMjiyGQT9XFj",
  "7FAKJMgNQzlqo7WZ",
  "PT9L7rrbI0hhrbj4",
  "NUARWmcMC9HKvG4l",
  "nKTadsXkEG4kbZtu",
  "GZYM8I2RH01en6zk",
  "CMWT5ysQBO6I3mcH",
  "HE5wUMp21rGLUlZ9",
  "Ax0LdyvyjU6E7Mne",
  "XHAsBXJ3IPw5mCpv",
  "I21XM2Aw6jODlMm6",
];
const published = [
  "axonProdValidation1",
  "axonProdWorker1",
  "axonProdStatus1",
  "nqwVZXqGsOwOhT0T",
];
function run(args, input, timeout = 240_000) {
  const r = spawnSync(exe, args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout,
    maxBuffer: 1024 * 1024,
  });
  if (r.status !== 0)
    throw Error(
      "Cutover operator command failed; stop and inspect the saved receipt. Raw output withheld.",
    );
  return r.stdout;
}
function main() {
  if (process.argv[2] !== "activate")
    throw Error("Use activate only after approved retention and fresh backups");
  for (const prefix of ["appdb-", "n8ndb-"]) {
    const d = path.join(root, ".cache/production-backups"),
      f = fs
        .readdirSync(d)
        .filter((n) => n.startsWith(prefix) && n.endsWith(".json"))
        .sort()
        .at(-1);
    if (
      !f ||
      Date.now() - fs.statSync(path.join(d, f)).mtimeMs > 30 * 60_000 ||
      !JSON.parse(fs.readFileSync(path.join(d, f), "utf8")).authenticated
    )
      throw Error("Fresh authenticated backups required");
  }
  const file = path.join(dir, "launch-cutover.json");
  if (fs.existsSync(file))
    throw Error(
      "Cutover already attempted; reconcile current state before retrying",
    );
  fs.writeFileSync(
    file,
    JSON.stringify(
      { at: new Date().toISOString(), retired, published, state: "preparing" },
      null,
      2,
    ) + "\n",
    { flag: "wx" },
  );
  const remote = `const fs=require('node:fs'),{spawnSync}=require('node:child_process');const run=a=>{const r=spawnSync('n8n',a,{encoding:'utf8',timeout:90000});if(r.status!==0)throw Error('CLI operation failed');};const d='/home/node/.n8n/axon-rollback';fs.mkdirSync(d,{recursive:true,mode:0o700});const before=d+'/health-before-launch.json';if(fs.existsSync(before))throw Error('Health rollback copy already exists');run(['export:workflow','--id=nqwVZXqGsOwOhT0T','--output='+before]);fs.chmodSync(before,0o600);const arr=JSON.parse(fs.readFileSync(before,'utf8'));const w=arr[0];if(w.id!=='nqwVZXqGsOwOhT0T')throw Error('Unexpected health workflow');for(const n of w.nodes){if(n.type==='n8n-nodes-base.postgres'){if(!/select\\s+1/i.test(n.parameters.query))throw Error('Unexpected health SQL');n.credentials={postgres:{id:'axonProductionValidator1',name:'Axon restricted production validator'}};}if(JSON.stringify(n.parameters).includes('$env'))throw Error('Health environment access unexpected');}w.active=false;w.settings={executionOrder:'v1',saveDataErrorExecution:'none',saveDataSuccessExecution:'none',saveManualExecutions:false,executionTimeout:30};const f=d+'/health-restricted.json';fs.writeFileSync(f,JSON.stringify([w]),{mode:0o600});run(['import:workflow','--input='+f,'--projectId=06gv3gYdnoJqwlu2']);for(const id of ${JSON.stringify(retired)})run(['unpublish:workflow','--id='+id]);for(const id of ${JSON.stringify(published)})run(['publish:workflow','--id='+id]);console.log('AXON_CUTOVER_PREPARED');`;
  const quote = (s) => "'" + s.replace(/'/g, "'\"'\"'") + "'";
  const result = run(
    [
      "ssh",
      "--project",
      project,
      "--environment",
      environment,
      "--service",
      service,
      "--",
      "node -e " + quote(remote),
    ],
    undefined,
    300_000,
  );
  if (!result.includes("AXON_CUTOVER_PREPARED"))
    throw Error("Workflow cutover not confirmed");
  const variables = {
    N8N_BLOCK_ENV_ACCESS_IN_NODE: "true",
    N8N_CONCURRENCY_PRODUCTION_LIMIT: "5",
    N8N_PAYLOAD_SIZE_MAX: "1",
    EXECUTIONS_TIMEOUT: "120",
    EXECUTIONS_DATA_SAVE_ON_ERROR: "none",
    EXECUTIONS_DATA_SAVE_ON_SUCCESS: "none",
    EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS: "false",
    EXECUTIONS_DATA_PRUNE: "true",
    EXECUTIONS_DATA_MAX_AGE: "168",
    EXECUTIONS_DATA_PRUNE_MAX_COUNT: "1000",
    N8N_DIAGNOSTICS_ENABLED: "false",
    N8N_PERSONALIZATION_ENABLED: "false",
    N8N_COMMUNITY_PACKAGES_ENABLED: "false",
    N8N_UNVERIFIED_PACKAGES_ENABLED: "false",
    N8N_WEBHOOK_URL: "https://axon-n8n-production-1512.up.railway.app/",
  };
  const response = JSON.parse(
    run(
      [
        "api",
        "mutation HardenRuntime($input:VariableCollectionUpsertInput!){variableCollectionUpsert(input:$input)}",
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
    throw Error("Runtime hardening rejected");
  const deployment = JSON.parse(
    run([
      "service",
      "redeploy",
      "--project",
      project,
      "--environment",
      environment,
      "--service",
      service,
      "--yes",
      "--json",
    ]),
  );
  const receipt = {
    at: new Date().toISOString(),
    retired,
    published,
    state: "deploying",
    deployment,
    settings: Object.keys(variables),
    retentionApproved: true,
  };
  fs.writeFileSync(file, JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt));
}
try {
  main();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}

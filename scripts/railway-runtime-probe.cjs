/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const file = path.join(root, ".cache/production-deployment/runtime-probe.json");
const exe = path.join(
  process.env.APPDATA,
  "npm/node_modules/@railway/cli/bin/railway.exe",
);
function ssh(command, input) {
  const r = spawnSync(
    exe,
    [
      "ssh",
      "--project",
      "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f",
      "--environment",
      "692d14bf-022f-4bb5-9f14-702f8ee8b606",
      "--service",
      "7e26464d-ff3f-4aa0-9d9b-b1dff1a28fa9",
      "--",
      command,
    ],
    { input, encoding: "utf8", windowsHide: true, timeout: 120_000 },
  );
  if (r.status !== 0)
    throw Error("Runtime probe operator command failed; raw output withheld");
  return r.stdout;
}
async function main() {
  if (process.argv[2] === "prepare") {
    if (fs.existsSync(file))
      throw Error("Probe already prepared; inspect before retrying");
    const probe = {
      id: "axonProductionRuntimeProbe",
      path: "axon-runtime-" + crypto.randomBytes(24).toString("hex"),
    };
    const names = [
      "Probe",
      "Restricted modules",
      "Restricted database",
      "Response",
    ];
    const w = {
      id: probe.id,
      name: "Axon temporary production runtime probe",
      active: false,
      nodes: [
        {
          id: "probe-hook",
          name: names[0],
          type: "n8n-nodes-base.webhook",
          typeVersion: 2,
          position: [0, 0],
          webhookId: crypto.randomUUID(),
          parameters: {
            httpMethod: "GET",
            path: probe.path,
            responseMode: "responseNode",
            options: {},
          },
        },
        {
          id: "probe-code",
          name: names[1],
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [220, 0],
          parameters: {
            jsCode:
              "const c=require('crypto'),d=require('dns'),h=require('https'),u=require('url');let denied=false;try{require('fs')}catch{denied=true}if(!denied||typeof d.lookup!=='function'||typeof h.request!=='function'||new u.URL('https://example.com').hostname!=='example.com'||c.createHash('sha256').update('probe').digest('hex').length!==64)throw Error('MODULE_POLICY_FAILED');return [{json:{ok:true}}];",
          },
        },
        {
          id: "probe-db",
          name: names[2],
          type: "n8n-nodes-base.postgres",
          typeVersion: 2.6,
          position: [440, 0],
          parameters: {
            operation: "executeQuery",
            query:
              "SELECT current_user='axon_validation' AS restricted_login,ssl AS tls FROM pg_stat_ssl WHERE pid=pg_backend_pid()",
            options: {},
          },
          credentials: {
            postgres: {
              id: "axonProductionValidator1",
              name: "Axon restricted production validator",
            },
          },
        },
        {
          id: "probe-response",
          name: names[3],
          type: "n8n-nodes-base.respondToWebhook",
          typeVersion: 1.4,
          position: [660, 0],
          parameters: {
            respondWith: "json",
            responseBody:
              "={{ {ok: $json.restricted_login === true && $json.tls === true} }}",
            options: { responseCode: 200 },
          },
        },
      ],
      connections: {},
      settings: {
        executionOrder: "v1",
        saveDataSuccessExecution: "none",
        saveDataErrorExecution: "none",
        saveManualExecutions: false,
        executionTimeout: 120,
      },
    };
    for (let i = 0; i < 3; i++)
      w.connections[names[i]] = {
        main: [[{ node: names[i + 1], type: "main", index: 0 }]],
      };
    fs.writeFileSync(file, JSON.stringify(probe), { flag: "wx", mode: 0o600 });
    const script =
      "const fs=require('node:fs'),{spawnSync}=require('node:child_process');let t='';process.stdin.on('data',c=>t+=c);process.stdin.on('end',()=>{const p='/tmp/axon-production-runtime-probe.json';try{fs.writeFileSync(p,t,{mode:0o600});for(const args of [['import:workflow','--input='+p,'--projectId=06gv3gYdnoJqwlu2'],['publish:workflow','--id=axonProductionRuntimeProbe']]){const r=spawnSync('n8n',args,{encoding:'utf8',timeout:90000});if(r.status!==0)throw Error('Probe preparation failed');}console.log('PROBE_PREPARED');}catch{process.exitCode=1;}finally{fs.rmSync(p,{force:true});}});";
    const quote = (s) => "'" + s.replace(/'/g, "'\"'\"'") + "'";
    if (
      !ssh("node -e " + quote(script), JSON.stringify(w)).includes(
        "PROBE_PREPARED",
      )
    )
      throw Error("Probe preparation not confirmed");
    console.log(
      "Temporary random-path, read-only probe prepared. Restart required; path withheld.",
    );
  } else if (process.argv[2] === "check") {
    const probe = JSON.parse(fs.readFileSync(file, "utf8"));
    const r = await fetch(
      "https://axon-n8n-production-1512.up.railway.app/webhook/" + probe.path,
      { signal: AbortSignal.timeout(30_000), redirect: "error" },
    );
    const body = await r.json();
    if (r.status !== 200 || body.ok !== true)
      throw Error("Production runtime probe failed; do not cut over");
    fs.writeFileSync(
      path.join(root, ".cache/production-deployment/runtime-probe-result.json"),
      JSON.stringify({
        at: new Date().toISOString(),
        httpStatus: r.status,
        restrictedModules: true,
        restrictedLogin: true,
        verifiedTls: true,
      }) + "\n",
    );
    console.log(
      "PASS production external Code runner, module restrictions and native restricted PostgreSQL credential over TLS.",
    );
  } else if (process.argv[2] === "unpublish") {
    ssh("n8n unpublish:workflow --id=axonProductionRuntimeProbe");
    console.log("Probe unpublished; restart required to unload route.");
  } else throw Error("Use prepare, check or unpublish");
}
main().catch(() => {
  console.error(
    "Runtime probe operation failed; inspect state before retrying. No raw payload printed.",
  );
  process.exitCode = 1;
});

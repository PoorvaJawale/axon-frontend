/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const dir = path.join(root, ".cache/production-deployment");
const credential = {
  id: "axonProductionValidator1",
  name: "Axon restricted production validator",
};
const projectId = "06gv3gYdnoJqwlu2";
function main() {
  if (process.argv[2] !== "import")
    throw Error("Use import; candidates remain inactive.");
  if (!fs.existsSync(path.join(dir, "login-verification.json")))
    throw Error("Verified restricted logins required");
  const password = JSON.parse(
    fs.readFileSync(
      path.join(root, ".cache/recovery-keys/database-logins.json"),
      "utf8",
    ),
  ).axon_validation;
  if (!/^[a-f0-9]{64}$/.test(password))
    throw Error("Invalid local login record");
  const files = [
    "validationproject.hardened.json",
    "background-worker.hardened.json",
    "validation-status.hardened.json",
  ];
  const ids = ["axonProdValidation1", "axonProdWorker1", "axonProdStatus1"];
  const workflows = files.map((file, i) => {
    const workflow = JSON.parse(
      fs.readFileSync(path.join(root, "backend/workflows", file), "utf8"),
    );
    workflow.id = ids[i];
    workflow.active = false;
    workflow.name = workflow.name.replace(
      "staging hardened",
      "production hardened",
    );
    for (const node of workflow.nodes) {
      if (node.type === "n8n-nodes-base.postgres")
        node.credentials = { postgres: credential };
      if (node.type === "n8n-nodes-base.httpRequest") {
        if (
          node.parameters.url !== "https://api.openai.com/v1/chat/completions"
        )
          throw Error("Unexpected model endpoint");
        node.credentials = {
          openAiApi: { id: "mDBfoN8uFavVnHbq", name: "OpenAI account" },
        };
      }
      if (node.type === "n8n-nodes-base.webhook")
        node.webhookId = crypto
          .createHash("sha256")
          .update(workflow.id + node.id)
          .digest("hex")
          .slice(0, 32);
    }
    if (JSON.stringify(workflow).includes("$env"))
      throw Error("Candidate unexpectedly accesses environment");
    return workflow;
  });
  const payload = {
    workflows,
    credentials: [
      {
        ...credential,
        type: "postgres",
        data: {
          host: "postgres-k-cw.railway.internal",
          database: "railway",
          user: "axon_validation",
          password,
          port: 5432,
          ssl: "require",
          allowUnauthorizedCerts: false,
          maxConnections: 3,
        },
      },
    ],
    ca: fs.readFileSync(path.join(dir, "application-ca.pem"), "utf8"),
  };
  const remote = `const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
let text='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>text+=c);process.stdin.on('end',()=>{const p=JSON.parse(text),d=fs.mkdtempSync(path.join(os.tmpdir(),'axon-import-'));try{fs.mkdirSync('/home/node/.n8n/axon-trust',{recursive:true});fs.writeFileSync('/home/node/.n8n/axon-trust/application-ca.pem',p.ca,{mode:0o644});for(const [kind,data]of [['credentials',p.credentials],['workflow',p.workflows]]){const f=path.join(d,kind+'.json');fs.writeFileSync(f,JSON.stringify(data),{mode:0o600});const r=spawnSync('n8n',['import:'+kind,'--input='+f,'--projectId=${projectId}'],{encoding:'utf8',timeout:90000});if(r.status!==0)throw Error('Inactive import failed: '+kind);}console.log('AXON_INACTIVE_IMPORT_OK');}catch{console.error('Inactive import failed; raw output withheld');process.exitCode=1;}finally{fs.rmSync(d,{recursive:true,force:true});}});`;
  const quote = (value) => "'" + value.replace(/'/g, "'\"'\"'") + "'";
  const exe = path.join(
    process.env.APPDATA,
    "npm/node_modules/@railway/cli/bin/railway.exe",
  );
  const result = spawnSync(
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
      "node -e " + quote(remote),
    ],
    {
      input: JSON.stringify(payload),
      encoding: "utf8",
      windowsHide: true,
      timeout: 240_000,
      maxBuffer: 1024 * 1024,
    },
  );
  if (
    result.status !== 0 ||
    !result.stdout?.includes("AXON_INACTIVE_IMPORT_OK")
  )
    throw Error(
      "Inactive production import failed; raw output withheld. Inspect metadata before retrying.",
    );
  const receipt = {
    at: new Date().toISOString(),
    workflows: workflows.map((w) => ({
      id: w.id,
      name: w.name,
      active: false,
    })),
    credentialId: credential.id,
    projectId,
    published: false,
  };
  fs.writeFileSync(
    path.join(dir, "inactive-workflows.json"),
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

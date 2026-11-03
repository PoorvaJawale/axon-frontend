/* eslint-disable @typescript-eslint/no-require-imports */
// Changes only the two existing native model-node request expressions. Credentials and graph stay intact.
const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto"),
  { spawnSync } = require("child_process");
const root = path.resolve(__dirname, ".."),
  dir = path.join(root, ".cache/production-deployment");
const project = "b390b3a0-b21a-4cee-8c3d-ad2c6b37043f",
  environment = "692d14bf-022f-4bb5-9f14-702f8ee8b606",
  service = "7e26464d-ff3f-4aa0-9d9b-b1dff1a28fa9";
const exe = path.join(
  process.env.APPDATA,
  "npm/node_modules/@railway/cli/bin/railway.exe",
);
function command(args, input) {
  const r = spawnSync(exe, args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 240000,
    maxBuffer: 1048576,
  });
  if (r.status !== 0)
    throw Error(
      "Production prompt operation failed; private diagnostics withheld. Check rollback receipt.",
    );
  return r.stdout;
}
function main() {
  const apply = process.argv.includes("--apply");
  const candidate = JSON.parse(
      fs.readFileSync(
        path.join(root, ".cache/staging/beta-model-eval-result.json"),
        "utf8",
      ),
    ),
    heldout = JSON.parse(
      fs.readFileSync(
        path.join(root, ".cache/staging/heldout-model-eval-result.json"),
        "utf8",
      ),
    );
  for (const [r, count] of [
    [candidate, 32],
    [heldout, 12],
  ])
    if (
      r.totalRun !== count ||
      r.passed !== count ||
      r.falsePasses ||
      r.falseBlocks ||
      Date.now() - Date.parse(r.completedAt) > 86400000
    )
      throw Error(
        "Recent complete native candidate and held-out evidence required",
      );
  const selected = [
    ["axonProdValidation1", "validationproject.hardened.json"],
    ["axonProdWorker1", "background-worker.hardened.json"],
  ].map(([id, file]) => {
    const w = JSON.parse(
        fs.readFileSync(path.join(root, "backend/workflows", file), "utf8"),
      ),
      nodes = w.nodes.filter(
        (n) =>
          n.type === "n8n-nodes-base.httpRequest" &&
          n.parameters.url === "https://api.openai.com/v1/chat/completions",
      );
    if (nodes.length !== 1) throw Error("Unexpected model count");
    return { id, jsonBody: nodes[0].parameters.jsonBody };
  });
  const evaluatedExpression = crypto
    .createHash("sha256")
    .update(selected[0].jsonBody)
    .digest("hex");
  for (const [report, file] of [
    [candidate, "beta-synthetic.json"],
    [heldout, "heldout-synthetic.json"],
  ]) {
    const cases = JSON.parse(
      fs.readFileSync(path.join(root, "backend/evals", file), "utf8"),
    );
    if (
      report.requestExpressionSha256 !== evaluatedExpression ||
      report.caseSetSha256 !==
        crypto.createHash("sha256").update(JSON.stringify(cases)).digest("hex")
    )
      throw Error(
        "Native evidence does not match this exact candidate/dataset",
      );
  }
  const summary = {
    at: new Date().toISOString(),
    project,
    environment,
    service,
    workflows: selected.map((w) => ({
      id: w.id,
      expressionSha256: crypto
        .createHash("sha256")
        .update(w.jsonBody)
        .digest("hex"),
    })),
    promptSha256: crypto
      .createHash("sha256")
      .update(require("../backend/n8n/judge-instructions.cjs"))
      .digest("hex"),
    mode: apply ? "apply" : "plan",
  };
  if (!apply) {
    console.log(JSON.stringify(summary));
    return;
  }
  const metadata = JSON.parse(
    fs.readFileSync(path.join(dir, "metadata18-switch.json"), "utf8"),
  );
  if (
    metadata.target !== "af53601a-765e-4d4e-b855-641f803d757c" ||
    !metadata.n8nSwitched
  )
    throw Error("Live metadata selector mismatch");
  const backupDir = path.join(root, ".cache/production-backups"),
    latest = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("n8ndb-") && f.endsWith(".json"))
      .sort()
      .at(-1);
  const receipt =
    latest && JSON.parse(fs.readFileSync(path.join(backupDir, latest), "utf8"));
  if (
    !receipt?.authenticated ||
    receipt.service !== metadata.target ||
    Date.now() - Date.parse(receipt.createdAt) > 1800000
  )
    throw Error("Fresh authenticated live metadata backup required");
  const suffix = Date.now() + "-" + crypto.randomBytes(4).toString("hex"),
    rollback = "/home/node/.n8n/axon-rollback/judge-" + suffix + ".json";
  const remote = `const fs=require('fs'),{spawnSync}=require('child_process');let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const p=JSON.parse(input),base='/home/node/.n8n/axon-rollback',before=[],after=[];fs.mkdirSync(base,{recursive:true,mode:0o700});const cli=a=>{const r=spawnSync('n8n',a,{encoding:'utf8',timeout:90000});if(r.status!==0)throw Error('Native workflow operation failed');};let imported=false;try{for(const item of p.workflows){const exportFile=base+'/read-'+p.suffix+'-'+item.id+'.json';cli(['export:workflow','--id='+item.id,'--output='+exportFile]);const list=JSON.parse(fs.readFileSync(exportFile,'utf8'));if(list.length!==1||list[0].id!==item.id)throw Error('Unexpected workflow');const w=list[0];before.push(structuredClone(w));const nodes=w.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest'&&n.parameters.url==='https://api.openai.com/v1/chat/completions');if(nodes.length!==1||(!nodes[0].parameters.jsonBody.includes('You validate AI actions.')&&nodes[0].parameters.jsonBody!==item.jsonBody))throw Error('Current model instructions changed; stop');nodes[0].parameters.jsonBody=item.jsonBody;after.push(w);fs.unlinkSync(exportFile);}fs.writeFileSync(p.rollback,JSON.stringify(before),{mode:0o600,flag:'wx'});const candidate=base+'/candidate-'+p.suffix+'.json';fs.writeFileSync(candidate,JSON.stringify(after),{mode:0o600,flag:'wx'});imported=true;cli(['import:workflow','--input='+candidate,'--projectId=06gv3gYdnoJqwlu2']);for(const w of after)cli(['publish:workflow','--id='+w.id]);console.log('AXON_JUDGE_PROMPT_APPLIED');}catch{if(imported){try{cli(['import:workflow','--input='+p.rollback,'--projectId=06gv3gYdnoJqwlu2']);for(const w of before)cli(['publish:workflow','--id='+w.id]);console.log('AXON_JUDGE_PROMPT_ROLLED_BACK');}catch{console.log('AXON_JUDGE_ROLLBACK_NEEDS_OPERATOR');}}process.exitCode=1;}});`;
  const quote = (x) => "'" + x.replace(/'/g, "'\"'\"'") + "'";
  fs.writeFileSync(
    path.join(dir, "judge-instructions-release.json"),
    JSON.stringify(
      { ...summary, rollback, metadataBackup: latest, state: "preparing" },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
  const output = command(
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
    JSON.stringify({ workflows: selected, suffix, rollback }),
  );
  if (!output.includes("AXON_JUDGE_PROMPT_APPLIED"))
    throw Error("Prompt publication not confirmed");
  fs.writeFileSync(
    path.join(dir, "judge-instructions-release.json"),
    JSON.stringify(
      {
        ...summary,
        rollback,
        metadataBackup: latest,
        state: "published-restart-required",
      },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
  command([
    "restart",
    "--project",
    project,
    "--environment",
    environment,
    "--service",
    service,
    "--yes",
  ]);
  fs.writeFileSync(
    path.join(dir, "judge-instructions-release.json"),
    JSON.stringify(
      {
        ...summary,
        rollback,
        metadataBackup: latest,
        state: "restart-requested",
      },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
  console.log(
    "Prompt-only update published to existing workflows; same-image restart requested. Verify live health before declaring completion.",
  );
}
try {
  main();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}

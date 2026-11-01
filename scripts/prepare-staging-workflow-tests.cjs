/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const local = path.join(root, ".cache/staging/n8n");
const out = path.join(local, "mock-workflows");
fs.mkdirSync(out, { recursive: true });
const config = [
  [
    "validationproject.hardened.json",
    "axonMockValidate",
    "Axon LOCAL MOCK validation",
    "axon-local-mock-validate",
  ],
  [
    "background-worker.hardened.json",
    "axonMockWorker",
    "Axon LOCAL MOCK worker",
    null,
  ],
  [
    "validation-status.hardened.json",
    "axonMockStatus",
    "Axon LOCAL MOCK status",
    "axon-local-mock-status",
  ],
];
for (const [file, id, name, endpoint] of config) {
  const w = JSON.parse(
    fs.readFileSync(path.join(local, "staging-workflows", file), "utf8"),
  );
  w.id = id;
  w.name = name;
  w.active = false;
  for (const n of w.nodes) {
    if (n.type === "n8n-nodes-base.webhook") {
      n.parameters.path = endpoint;
      n.webhookId = id + "Webhook";
    }
    if (n.type === "n8n-nodes-base.httpRequest") {
      const source = id === "axonMockWorker" ? "Job Context" : "Attach Context";
      n.type = "n8n-nodes-base.code";
      n.typeVersion = 2;
      delete n.credentials;
      delete n.onError;
      n.continueOnFail = false;
      n.parameters = {
        jsCode: `const content=$node[${JSON.stringify(source)}].json.body.content;const mode=content?.mockVerdict||'PASS';const judge={verdict:mode==='BLOCK'?'BLOCK':'PASS',risk:mode==='HIGH'?'HIGH':'LOW',confidence:0.99,category:'OTHER',reason:'SIMULATED local fixture, not a real model assessment'};if(mode==='TAMPER')judge.user_id='forged-user';return [{json:{choices:[{message:{content:mode==='MALFORMED'?'invalid json':JSON.stringify(judge)}}]}}];`,
      };
    }
  }
  fs.writeFileSync(path.join(out, file), JSON.stringify(w, null, 2));
}
console.log(
  "Prepared three separate LOCAL MOCK copies. Only model response nodes and test webhook paths differ; no OpenAI/provider access or candidate publication.",
);

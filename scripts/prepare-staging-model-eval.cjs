/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
try {
  const raw = execFileSync(
    "docker",
    [
      "exec",
      "axon-local-staging-n8n-1",
      "node",
      "-e",
      "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/home/node/.n8n/database.sqlite',{readOnly:true});console.log(JSON.stringify(db.prepare('SELECT id,name FROM credentials_entity WHERE type=?').all('openAiApi')));db.close()",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 },
  );
  const credentials = JSON.parse(raw.trim()).filter(
    (entry) =>
      entry.name.trim().replace(/\s+/g, " ").toLowerCase() ===
      "axon staging openai",
  );
  if (credentials.length !== 1)
    throw Error(
      "Create exactly one local OpenAI credential named Axon staging OpenAI; no secret data was read.",
    );
  const file = path.join(
    root,
    ".cache/staging/n8n/staging-workflows/validationproject.hardened.json",
  );
  const workflow = JSON.parse(fs.readFileSync(file, "utf8"));
  workflow.id = "axonModelEval";
  workflow.name = "Axon LOCAL real-model smoke evaluation";
  workflow.active = false;
  const webhookPath =
    "axon-model-eval-" + crypto.randomBytes(12).toString("hex");
  for (const node of workflow.nodes) {
    if (node.type === "n8n-nodes-base.webhook") {
      node.parameters.path = webhookPath;
      node.webhookId = "axonModelEvalWebhook";
    }
    if (node.type === "n8n-nodes-base.httpRequest") {
      if (node.parameters.url !== "https://api.openai.com/v1/chat/completions")
        throw Error("Unexpected model endpoint; refusing to bind credentials.");
      node.credentials = {
        openAiApi: { id: credentials[0].id, name: credentials[0].name },
      };
    }
  }
  fs.writeFileSync(
    path.join(root, ".cache/staging/n8n/model-eval-workflow.json"),
    JSON.stringify(workflow, null, 2),
  );
  fs.writeFileSync(
    path.join(root, ".cache/staging/model-eval-config.json"),
    JSON.stringify({ id: workflow.id, path: webhookPath }, null, 2),
  );
  console.log(
    "Prepared a separate local native GPT-4o mini workflow copy. Credential metadata only was read; original candidates remain unchanged/unpublished.",
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

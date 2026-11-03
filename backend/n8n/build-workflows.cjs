/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const judgeInstructions = require("./judge-instructions.cjs");
const source = process.argv[2];
if (!source)
  throw Error(
    "Pass the folder containing the supplied workflow exports. Originals are read only.",
  );
const out = path.resolve("backend/workflows");
fs.mkdirSync(out, { recursive: true });
const policy = fs
  .readFileSync("backend/n8n/policy.cjs", "utf8")
  .replace(/module\.exports\s*=[\s\S]*$/, "");
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(source, name + " (1).json"), "utf8"));
const node = (w, name) => {
  const n = w.nodes.find((n) => n.name === name);
  if (!n) throw Error("Missing node " + name);
  return n;
};
const code = (w, name, text) => {
  node(w, name).parameters = { jsCode: text };
};
const edge = (w, a, b) => {
  w.connections[a] = { main: [[{ node: b, type: "main", index: 0 }]] };
};
const sql = (name, query, params) => ({
  id: crypto.randomUUID(),
  name,
  type: "n8n-nodes-base.postgres",
  typeVersion: 2.6,
  position: [800, 600],
  parameters: {
    operation: "executeQuery",
    query,
    options: { queryReplacement: params },
  },
});
const codeNode = (name, jsCode) => ({
  id: crypto.randomUUID(),
  name,
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [1000, 600],
  parameters: { jsCode },
});
function clean(w) {
  w.active = false;
  delete w.id;
  delete w.versionId;
  delete w.meta;
  delete w.pinData;
  delete w.staticData;
  delete w.shared;
  w.settings = {
    executionOrder: "v1",
    saveDataErrorExecution: "none",
    saveDataSuccessExecution: "none",
    saveManualExecutions: false,
    executionTimeout: 120,
  };
  for (const n of w.nodes) {
    const h = crypto
      .createHash("sha256")
      .update(w.name + ":" + n.name)
      .digest("hex")
      .slice(0, 32);
    n.id = [
      h.slice(0, 8),
      h.slice(8, 12),
      h.slice(12, 16),
      h.slice(16, 20),
      h.slice(20),
    ].join("-");
    delete n.credentials;
    if (
      n.type === "n8n-nodes-base.code" &&
      /^\s*\{/.test(n.parameters?.jsCode || "")
    ) {
      try {
        n.parameters.jsCode =
          "return [{json:" +
          JSON.stringify(JSON.parse(n.parameters.jsCode)) +
          "}];";
      } catch {
        /* Non-JSON JavaScript block: keep source. */
      }
    }
    n.retryOnFail = false;
    if (n.parameters)
      for (const k of ["queryReplacement", "responseBody"])
        if (typeof n.parameters[k] === "string")
          n.parameters[k] = n.parameters[k].replace(/^==/, "=");
    if (n.parameters?.options?.queryReplacement)
      n.parameters.options.queryReplacement =
        n.parameters.options.queryReplacement.replace(/^==/, "=");
  }
  return w;
}
const manifest = [];
function save(w, file) {
  clean(w);
  fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
  fs.writeFileSync(path.join(out, file), JSON.stringify(w, null, 2) + "\n");
  manifest.push({
    file,
    name: w.name,
    sha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(out, file)))
      .digest("hex"),
  });
}
let w = read("validationproject");
w.name = "Axon Validation — staging hardened";
code(
  w,
  "Code in JavaScript12",
  policy +
    `\ntry { const input=validateInput($json.body);return [{json:{...input,headers:$json.headers}}]; }catch(error){return [{json:{payload_blocked:true,reason:error.message}}];}`,
);
code(
  w,
  "Code in JavaScript8",
  `const crypto=require('crypto');const auth=String($json.headers?.authorization||'');const key=/^Bearer (sk-axon-[a-f0-9]{48})$/i.exec(auth)?.[1]||'';const hash=crypto.createHash('sha256').update(key).digest('hex');const header=$json.headers?.['idempotency-key'];if(header!==undefined&&!/^[a-zA-Z0-9_-]{16,80}$/.test(header))throw Error('INVALID_IDEMPOTENCY_KEY');const id='validation:'+crypto.createHash('sha256').update(hash+':'+String(header||$execution.id)).digest('hex');return [{json:{...$json,hashed_key:hash,reservation_id:id}}];`,
);
node(w, "Execute a SQL query").parameters = {
  operation: "executeQuery",
  query: "SELECT axon_security.reserve_validation($1,$2,$3::jsonb,$4) AS data;",
  options: {
    queryReplacement:
      "={{ [$json.hashed_key,$json.reservation_id,JSON.stringify($json.body),$json.route] }}",
  },
};
code(
  w,
  "Attach Context",
  `const input=$node['Code in JavaScript8'].json;const trusted=$node['Code in JavaScript9'].json;return [{json:{body:input.body,validation_route:input.route,request_id:trusted.reservation_id,...trusted}}];`,
);
// The DB function returns booleans, not compatibility key counters.
for (const [name, field] of [
  ["If1", "authenticated"],
  ["If2", "quota_allowed"],
])
  node(w, name).parameters = {
    conditions: {
      options: { typeValidation: "strict", version: 2 },
      conditions: [
        {
          leftValue: "={{ $json." + field + " }}",
          rightValue: true,
          operator: { type: "boolean", operation: "true", singleValue: true },
        },
      ],
      combinator: "and",
    },
    options: {},
  };
code(
  w,
  "Code in JavaScript6",
  `return [{json:{http_status:$json.http_status||401,reason:$json.reason||'Invalid API key'}}];`,
);
node(w, "Respond Unauthorized").parameters = {
  respondWith: "json",
  responseBody: '={{ {status:"ERROR",validated:false,reason:$json.reason} }}',
  options: { responseCode: "={{ $json.http_status }}" },
};
code(
  w,
  "Code in JavaScript7",
  `return [{json:{http_status:$json.http_status||503,reason:$json.reason||'Validation unavailable'}}];`,
);
node(w, "Respond Limit Exceeded").parameters = {
  respondWith: "json",
  responseBody: '={{ {status:"ERROR",validated:false,reason:$json.reason} }}',
  options: { responseCode: "={{ $json.http_status }}" },
};
node(w, "Respond to Webhook2").parameters = {
  respondWith: "json",
  responseBody: '={{ {status:"ERROR",validated:false,reason:$json.reason} }}',
  options: { responseCode: 400 },
};
// Guard already validates before quota reservation. This compatibility gate never reads model data.
code(
  w,
  "Code in JavaScript1",
  `return [{json:{...$json,schema_result:'PASSED',approved:true}}];`,
);
code(
  w,
  "Code in JavaScript",
  `return [{json:{status:'SKIPPED',validated:false,validation_skipped:true,reason:'Internal reasoning was not validated or dispatched'}}];`,
);
const skip = structuredClone(node(w, "Respond to Webhook1"));
skip.id = crypto.randomUUID();
skip.name = "Respond Skipped";
skip.parameters = {
  respondWith: "json",
  responseBody: "={{ $json }}",
  options: { responseCode: 200 },
};
w.nodes.push(skip);
edge(w, "Code in JavaScript", "Respond Skipped");
w.connections["Attach Context"].main = [
  [{ node: "Switch", type: "main", index: 0 }],
];
// Route selection uses a server-derived label, never caller-supplied risk overrides.
node(w, "Switch").parameters.rules.values.forEach(
  (v) =>
    (v.conditions.conditions[0].leftValue = "={{ $json.validation_route }}"),
);
const model = node(w, "Message a model");
model.type = "n8n-nodes-base.httpRequest";
model.typeVersion = 4.2;
model.parameters = {
  method: "POST",
  url: "https://api.openai.com/v1/chat/completions",
  authentication: "predefinedCredentialType",
  nodeCredentialType: "openAiApi",
  sendBody: true,
  specifyBody: "json",
  jsonBody: `={{ {model:"gpt-4o-mini",store:false,max_completion_tokens:300,temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:${JSON.stringify(judgeInstructions)}},{role:"user",content:JSON.stringify({action_type:$node["Attach Context"].json.body.action_type,content:$node["Attach Context"].json.body.content})}]} }}`,
  options: { timeout: 15000 },
};
model.onError = "continueRegularOutput";
edge(w, "Message a model", "Code in JavaScript11");
const parse =
  policy +
  `\nconst src=$node['Attach Context'].json;try{const judge=parseJudge($json.choices?.[0]?.message?.content);return [{json:{...src,judge,...judge}}];}catch{return [{json:{...src,judge_error:true}}];}`;
code(w, "Code in JavaScript11", parse);
const judgeGate = {
  id: crypto.randomUUID(),
  name: "Judge Available",
  type: "n8n-nodes-base.if",
  typeVersion: 2.2,
  position: [1200, 300],
  parameters: {
    conditions: {
      options: { typeValidation: "strict", version: 2 },
      conditions: [
        {
          leftValue: "={{ $json.judge_error === true }}",
          operator: { type: "boolean", operation: "true", singleValue: true },
        },
      ],
      combinator: "and",
    },
    options: {},
  },
};
w.nodes.push(judgeGate);
edge(w, "Code in JavaScript11", "Judge Available");
w.nodes.push(
  sql(
    "Release Internal Failure",
    "SELECT axon_security.finish_sync($1,$2,true);",
    '={{ [$node["Attach Context"].json.user_id,$node["Attach Context"].json.reservation_id] }}',
  ),
);
w.connections["Judge Available"] = {
  main: [
    [{ node: "Release Internal Failure", type: "main", index: 0 }],
    [{ node: "If", type: "main", index: 0 }],
  ],
};
edge(w, "Release Internal Failure", "Respond to Webhook3");
node(w, "Respond to Webhook3").parameters.options = { responseCode: 503 };
// No dispatch on BLOCK. Store metadata only, never raw output or model raw text.
for (const name of ["Insert rows in a table", "Insert rows in a table1"]) {
  const n = node(w, name);
  const position = n.position;
  Object.assign(
    n,
    sql(
      name,
      "INSERT INTO public.validation_logs(user_id,agent_id,request_id,action_type,schema_result,semantic_result,final_verdict,reason,raw_output) VALUES($1,$2,$3,$4,'PASSED',$5,$5,$6,'{}'::jsonb) ON CONFLICT(request_id) WHERE request_id IS NOT NULL DO NOTHING RETURNING id;",
      '={{ [$json.user_id,$json.body.agent_id,$json.reservation_id,$json.body.action_type,$json.verdict,$json.category+" / "+$json.risk+" / "+$json.verdict] }}',
    ),
  );
  n.position = position;
  delete n.onError;
}
w.nodes.push(
  sql(
    "Finish Sync Pass",
    "SELECT axon_security.finish_sync($1,$2,false);",
    '={{ [$node["Code in JavaScript11"].json.user_id,$node["Code in JavaScript11"].json.reservation_id] }}',
  ),
);
w.nodes.push(
  sql(
    "Finish Sync Block",
    "SELECT axon_security.finish_sync($1,$2,false);",
    '={{ [$node["Code in JavaScript11"].json.user_id,$node["Code in JavaScript11"].json.reservation_id] }}',
  ),
);
edge(w, "Insert rows in a table", "Finish Sync Pass");
edge(w, "Finish Sync Pass", "HTTP Request");
const callback =
  policy +
  `\nconst src=$node['Code in JavaScript11'].json;let delivery='not_requested';if(src.body.mode==='validate_and_dispatch'){try{if(src.callback_verified!==true)throw Error('UNVERIFIED_CALLBACK');const signed=signedEnvelope({request_id:src.reservation_id,body:src.body},src.judge,src.webhook_secret);await pinnedPost(src.body.execution_endpoint,signed.bytes,signed.headers);delivery='delivered';}catch{delivery='unconfirmed';}}return [{json:{status:src.verdict,validated:true,request_id:src.reservation_id,delivery,execution_confirmed:false}}];`;
const oldHttp = node(w, "HTTP Request");
Object.assign(oldHttp, codeNode("HTTP Request", callback));
edge(w, "HTTP Request", "Respond to Webhook1");
node(w, "Respond to Webhook1").parameters = {
  respondWith: "json",
  responseBody: "={{ $json }}",
  options: { responseCode: 200 },
};
edge(w, "Insert rows in a table1", "Finish Sync Block");
edge(w, "Finish Sync Block", "Respond to Webhook");
node(w, "Respond to Webhook").parameters = {
  respondWith: "json",
  responseBody:
    '={{ {status:"BLOCK",validated:true,reason:$node["Code in JavaScript11"].json.reason,request_id:$node["Code in JavaScript11"].json.reservation_id,delivery:"not_attempted"} }}',
  options: { responseCode: 200 },
};
edge(w, "Code in JavaScript5", "Respond Async");
node(w, "Respond Async").parameters = {
  respondWith: "json",
  responseBody:
    '={{ {status:"PROCESSING",validated:false,async:true,request_id:$node["Attach Context"].json.reservation_id,message:"Validation queued. Do not execute yet."} }}',
  options: { responseCode: 202 },
};
// Remove disconnected unsafe callbacks/retries/increments rather than leaving executable dead branches.
const remove = new Set([
  "HTTP Request1",
  "Code in JavaScript4",
  "Execute a SQL query2",
  "Code in JavaScript15",
  "Insert rows in a table2",
  "Call 'Background Semantic Validator'",
  "Message a model1",
  "Message a model2",
  "If4",
  "If5",
  "If6",
]);
w.nodes = w.nodes.filter((n) => !remove.has(n.name));
for (const name of remove) delete w.connections[name];
save(w, "validationproject.hardened.json");
// A durable polling worker replaces the fire-and-forget background branch.
const worker = {
  name: "Axon Background Worker — staging hardened",
  nodes: [],
  connections: {},
};
worker.nodes.push({
  id: crypto.randomUUID(),
  name: "Every Five Seconds",
  type: "n8n-nodes-base.scheduleTrigger",
  typeVersion: 1.2,
  position: [0, 0],
  parameters: {
    rule: { interval: [{ field: "seconds", secondsInterval: 5 }] },
  },
});
worker.nodes.push(
  sql(
    "Maintenance",
    "SELECT axon_security.maintain_validation();",
    "={{ [] }}",
  ),
);
worker.nodes.push(
  sql(
    "Claim Job",
    "SELECT axon_security.claim_validation() AS data;",
    "={{ [] }}",
  ),
);
worker.nodes.push(
  codeNode(
    "Job Context",
    `if(!$json.data)return [];return [{json:$json.data}];`,
  ),
);
edge(worker, "Every Five Seconds", "Claim Job");
worker.nodes.push({
  id: crypto.randomUUID(),
  name: "Recovery Every Minute",
  type: "n8n-nodes-base.scheduleTrigger",
  typeVersion: 1.2,
  position: [0, 600],
  parameters: {
    rule: { interval: [{ field: "minutes", minutesInterval: 1 }] },
  },
});
edge(worker, "Recovery Every Minute", "Maintenance");
edge(worker, "Claim Job", "Job Context");
const workerModel = structuredClone(model);
workerModel.name = "Judge";
workerModel.id = crypto.randomUUID();
workerModel.parameters.jsonBody = workerModel.parameters.jsonBody.replaceAll(
  '$node["Attach Context"]',
  '$node["Job Context"]',
);
worker.nodes.push(workerModel);
worker.nodes.push({
  id: crypto.randomUUID(),
  name: "Decision Saved",
  type: "n8n-nodes-base.if",
  typeVersion: 2.2,
  position: [1000, 0],
  parameters: {
    conditions: {
      options: { typeValidation: "strict", version: 2 },
      conditions: [
        {
          leftValue: "={{ !!$json.cached_judge }}",
          operator: { type: "boolean", operation: "true", singleValue: true },
        },
      ],
      combinator: "and",
    },
    options: {},
  },
});
edge(worker, "Job Context", "Decision Saved");
worker.connections["Decision Saved"] = {
  main: [
    [{ node: "Parse", type: "main", index: 0 }],
    [{ node: "Judge", type: "main", index: 0 }],
  ],
};
worker.nodes.push(
  codeNode(
    "Parse",
    policy +
      `\nconst src=$node['Job Context'].json;try{return [{json:{...src,judge:parseJudge(src.cached_judge||$json.choices?.[0]?.message?.content)}}];}catch{return [{json:{...src,error_code:'JUDGE_UNAVAILABLE'}}];}`,
  ),
);
edge(worker, "Judge", "Parse");
worker.nodes.push(
  sql(
    "Save Decision",
    "SELECT CASE WHEN $3::jsonb IS NULL THEN $4::jsonb ELSE axon_security.save_judge($1,$2,$3::jsonb) END AS data;",
    "={{ [$json.request_id,$json.attempt,$json.judge?JSON.stringify($json.judge):null,JSON.stringify($json)] }}",
  ),
);
edge(worker, "Parse", "Save Decision");
worker.nodes.push(
  sql(
    "Delivery Context",
    "SELECT $1::jsonb AS data,(SELECT signing_secret FROM axon_security.callback_destinations WHERE user_id=k.user_id AND url=$1::jsonb->'body'->>'execution_endpoint' AND verified_at IS NOT NULL) AS webhook_secret,EXISTS(SELECT 1 FROM axon_security.callback_destinations d WHERE d.user_id=k.user_id AND d.url=$1::jsonb->'body'->>'execution_endpoint' AND d.verified_at IS NOT NULL) AS callback_verified FROM public.api_keys k WHERE k.user_id=$1::jsonb->>'user_id' AND k.id=($1::jsonb->>'key_id')::bigint AND k.is_active AND k.expires_at>now();",
    "={{ [JSON.stringify($json.data)] }}",
  ),
);
edge(worker, "Save Decision", "Delivery Context");
worker.nodes.push(
  codeNode(
    "Deliver Approved",
    policy +
      `\nconst src=$json.data;if(!src)return [];let error=src.error_code||null;if(!error&&src.judge.verdict==='PASS'&&src.body.mode==='validate_and_dispatch'){try{if(!$json.callback_verified)throw Error('UNVERIFIED_CALLBACK');const signed=signedEnvelope(src,src.judge,$json.webhook_secret);await pinnedPost(src.body.execution_endpoint,signed.bytes,signed.headers);}catch{error='DELIVERY_UNCONFIRMED';}}return [{json:{request_id:src.request_id,attempt:src.attempt,error_code:error}}];`,
  ),
);
edge(worker, "Delivery Context", "Deliver Approved");
worker.nodes.push(
  sql(
    "Finish Job",
    "SELECT axon_security.finish_job($1,$2,$3);",
    "={{ [$json.request_id,$json.attempt,$json.error_code] }}",
  ),
);
edge(worker, "Deliver Approved", "Finish Job");
save(worker, "background-worker.hardened.json");
const status = {
  name: "Axon Validation Status — staging hardened",
  nodes: [],
  connections: {},
};
status.nodes.push({
  id: crypto.randomUUID(),
  name: "Status Webhook",
  type: "n8n-nodes-base.webhook",
  typeVersion: 2,
  position: [0, 0],
  parameters: {
    httpMethod: "GET",
    path: "validation-status",
    responseMode: "responseNode",
    options: {},
  },
});
status.nodes.push(
  codeNode(
    "Authenticate",
    `const key=/^Bearer (sk-axon-[a-f0-9]{48})$/i.exec(String($json.headers?.authorization||''))?.[1]||'';const id=String($json.query?.request_id||'');if(!/^validation:[a-f0-9]{64}$/.test(id))throw Error('INVALID_REQUEST_ID');return [{json:{hash:require('crypto').createHash('sha256').update(key).digest('hex'),id}}];`,
  ),
);
status.nodes.push(
  sql(
    "Read Status",
    "SELECT j.state,j.result,j.error_code,j.delivery_state FROM axon_security.validation_jobs j JOIN public.api_keys k ON k.user_id=j.user_id WHERE k.hashed_api_key=$1 AND k.is_active AND k.expires_at>now() AND j.request_id=$2 LIMIT 1",
    "={{ [$json.hash,$json.id] }}",
  ),
);
status.nodes[2].alwaysOutputData = true;
status.nodes.push({
  id: crypto.randomUUID(),
  name: "Respond Status",
  type: "n8n-nodes-base.respondToWebhook",
  typeVersion: 1.4,
  position: [1000, 0],
  parameters: {
    respondWith: "json",
    responseBody:
      '={{ !$json.state ? {status:"NOT_FOUND",validated:false} : {status:$json.result?.verdict||($json.state==="failed"?"ERROR":"PROCESSING"),validated:!!$json.result,reason:$json.result?.reason||null,job_state:$json.state,delivery:$json.delivery_state,execution_confirmed:false} }}',
    options: {
      responseCode: "={{ $json.state ? 200 : 404 }}",
      responseHeaders: {
        entries: [{ name: "Cache-Control", value: "private, no-store" }],
      },
    },
  },
});
edge(status, "Status Webhook", "Authenticate");
edge(status, "Authenticate", "Read Status");
edge(status, "Read Status", "Respond Status");
save(status, "validation-status.hardened.json");
for (const name of [
  "Alerts API",
  "API Keys API",
  "Axon Health",
  "Billing Update",
  "Error Handler",
  "Logs API",
  "Monthly Usage Reset",
  "Revoke Key API",
  "Usage API",
  "API Key Workflow",
]) {
  const copy = read(name);
  copy.name += " — staging reference";
  save(
    copy,
    "reference/" + name.replaceAll(" ", "-").toLowerCase() + ".reference.json",
  );
}
fs.writeFileSync(
  path.join(out, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "Created " +
    manifest.length +
    " sanitized, inactive workflow files in " +
    out,
);

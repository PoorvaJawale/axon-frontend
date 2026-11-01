/* eslint-disable @typescript-eslint/no-require-imports -- Shared n8n Code-node runtime uses allowlisted Node builtins. */
/* Shared, dependency-free policy. Injected verbatim into n8n Code nodes by build-workflows.cjs. */
function parseJudge(raw) {
  const p = typeof raw === "string" ? JSON.parse(raw) : raw;
  const keys = ["verdict", "risk", "confidence", "category", "reason"];
  if (
    !p ||
    Array.isArray(p) ||
    typeof p !== "object" ||
    Object.keys(p).length !== keys.length ||
    Object.keys(p).some((k) => !keys.includes(k))
  )
    throw Error("INVALID_JUDGE");
  if (
    !["PASS", "BLOCK"].includes(p.verdict) ||
    !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(p.risk) ||
    typeof p.confidence !== "number" ||
    !Number.isFinite(p.confidence) ||
    p.confidence < 0 ||
    p.confidence > 1 ||
    !["HALLUCINATION", "POLICY", "SAFETY", "COMPLIANCE", "OTHER"].includes(
      p.category,
    ) ||
    typeof p.reason !== "string" ||
    !p.reason.trim() ||
    p.reason.length > 500
  )
    throw Error("INVALID_JUDGE");
  // Low-confidence and high-risk results never authorize execution.
  return {
    verdict:
      p.verdict === "PASS" &&
      (p.confidence < 0.8 || ["HIGH", "CRITICAL"].includes(p.risk))
        ? "BLOCK"
        : p.verdict,
    risk: p.risk,
    confidence: p.confidence,
    category: p.category,
    reason: p.reason,
  };
}
function validateInput(body) {
  if (!body || Array.isArray(body) || typeof body !== "object")
    throw Error("INVALID_BODY");
  if (Buffer.byteLength(JSON.stringify(body)) > 16384)
    throw Error("PAYLOAD_TOO_LARGE");
  if (
    typeof body.agent_id !== "string" ||
    !body.agent_id.trim() ||
    body.agent_id.length > 100
  )
    throw Error("INVALID_AGENT");
  if (
    ![
      "email_send",
      "db_write",
      "payment",
      "live_chat",
      "api_call",
      "internal_reasoning",
    ].includes(body.action_type)
  )
    throw Error("INVALID_ACTION");
  if (
    body.content === null ||
    !["string", "object"].includes(typeof body.content) ||
    Buffer.byteLength(JSON.stringify(body.content)) > 12000
  )
    throw Error("INVALID_CONTENT");
  const mode = body.mode === undefined ? "validate_only" : body.mode;
  if (!["validate_only", "validate_and_dispatch"].includes(mode))
    throw Error("INVALID_MODE");
  if (
    body.risk_level !== undefined &&
    !["internal_reasoning", "live_chat", "external_action"].includes(
      body.risk_level,
    )
  )
    throw Error("INVALID_RISK");
  if (
    body.metadata !== undefined &&
    (!body.metadata ||
      Array.isArray(body.metadata) ||
      typeof body.metadata !== "object" ||
      Buffer.byteLength(JSON.stringify(body.metadata)) > 2048)
  )
    throw Error("INVALID_METADATA");
  // A caller cannot mark a payment/email/write as internal reasoning to bypass validation.
  const route =
    body.action_type === "internal_reasoning"
      ? "skip"
      : body.action_type === "live_chat"
        ? "async"
        : "sync";
  let endpoint = null;
  if (mode === "validate_and_dispatch") {
    if (route === "skip") throw Error("SKIP_CANNOT_DISPATCH");
    endpoint = callbackUrl(body.execution_endpoint).href;
  }
  return {
    body: {
      agent_id: body.agent_id,
      action_type: body.action_type,
      content: body.content,
      metadata: body.metadata || {},
      mode,
      execution_endpoint: endpoint,
    },
    route,
  };
}
function callbackUrl(raw) {
  if (typeof raw !== "string" || raw.length > 2048)
    throw Error("INVALID_CALLBACK");
  const u = new (require("url").URL)(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.hash ||
    u.search ||
    (u.port && u.port !== "443") ||
    !u.hostname.includes(".") ||
    u.hostname.endsWith(".") ||
    u.hostname.endsWith(".local") ||
    u.hostname.endsWith(".internal") ||
    u.hostname.startsWith("[") ||
    /^\d+(\.\d+)*$/.test(u.hostname)
  )
    throw Error("INVALID_CALLBACK");
  return u;
}
function publicIpv4(address) {
  const parts = address.split(".");
  if (parts.length !== 4 || parts.some((x) => !/^\d{1,3}$/.test(x) || +x > 255))
    return false;
  const [a, b, c] = parts.map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}
async function pinnedPost(raw, bytes, headers = {}, dependencies = {}) {
  const https = dependencies.https || require("https");
  const dns = dependencies.dns || require("dns").promises;
  const u = callbackUrl(raw);
  // IPv4 only at launch; reject the whole DNS answer set if any record is unsafe.
  let timer;
  const records = await Promise.race([
    dns.resolve4(u.hostname),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(Error("DNS_TIMEOUT")), 3000);
    }),
  ]).finally(() => clearTimeout(timer));
  if (!records.length || records.some((ip) => !publicIpv4(ip)))
    throw Error("UNSAFE_ADDRESS");
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: "https:",
        hostname: u.hostname,
        servername: u.hostname,
        path: u.pathname,
        port: 443,
        method: "POST",
        agent: false,
        family: 4,
        autoSelectFamily: false,
        rejectUnauthorized: true,
        lookup: (_host, _opts, done) => done(null, records[0], 4),
        headers: {
          ...headers,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(bytes),
        },
      },
      (res) => {
        let size = 0;
        const chunks = [];
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > 65536) {
            res.destroy();
            reject(Error("RESPONSE_TOO_LARGE"));
          } else chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300)
            return reject(Error("DELIVERY_HTTP_" + res.statusCode));
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      },
    );
    const deadline = setTimeout(
      () => req.destroy(Error("DELIVERY_TIMEOUT")),
      10000,
    );
    req.on("close", () => clearTimeout(deadline));
    req.on("error", reject);
    req.end(bytes);
  });
}
function signedEnvelope(
  job,
  judge,
  secret,
  now = Math.floor(Date.now() / 1000),
) {
  if (typeof secret !== "string" || secret.length < 32)
    throw Error("SIGNING_SECRET_MISSING");
  if (judge.verdict !== "PASS") throw Error("BLOCK_CANNOT_DISPATCH");
  const bytes = JSON.stringify({
    event_id: job.request_id,
    type: "action.approved",
    timestamp: now,
    agent_id: job.body.agent_id,
    action_type: job.body.action_type,
    content: job.body.content,
  });
  const signature = require("crypto")
    .createHmac("sha256", secret)
    .update(now + "." + bytes)
    .digest("hex");
  return {
    bytes,
    headers: {
      "x-axon-timestamp": String(now),
      "x-axon-event-id": job.request_id,
      "x-axon-signature": signature,
    },
  };
}
function logReason(judge) {
  return judge.category + " / " + judge.risk + " / " + judge.verdict;
}
function verifyEnvelope(
  raw,
  headers,
  secret,
  now = Math.floor(Date.now() / 1000),
) {
  if (
    typeof raw !== "string" ||
    Buffer.byteLength(raw) > 16384 ||
    typeof secret !== "string" ||
    secret.length < 32
  )
    throw Error("INVALID_CALLBACK");
  const timestamp = String(headers["x-axon-timestamp"] || ""),
    signature = String(headers["x-axon-signature"] || "");
  if (
    !/^[0-9]{10}$/.test(timestamp) ||
    Math.abs(now - Number(timestamp)) > 300 ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    throw Error("INVALID_SIGNATURE");
  const crypto = require("crypto");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp + "." + raw)
    .digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature, "hex")))
    throw Error("INVALID_SIGNATURE");
  const event = JSON.parse(raw);
  if (
    !event ||
    event.type !== "action.approved" ||
    event.event_id !== headers["x-axon-event-id"] ||
    typeof event.event_id !== "string" ||
    event.event_id.length > 128 ||
    event.timestamp !== Number(timestamp)
  )
    throw Error("INVALID_EVENT");
  return event;
}
module.exports = {
  verifyEnvelope,
  logReason,
  parseJudge,
  validateInput,
  callbackUrl,
  publicIpv4,
  pinnedPost,
  signedEnvelope,
};

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const settings = path.resolve(__dirname, "../.cache/staging/frontend.env");
const receipt = path.resolve(
  __dirname,
  "../.cache/staging/razorpay-plan-operation.json",
);
function parse(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => {
        const i = l.indexOf("=");
        let value = l.slice(i + 1).trim();
        if ((value[0] === '"' || value[0] === "'") && value.at(-1) === value[0])
          value = value.slice(1, -1);
        return [l.slice(0, i), value];
      }),
  );
}
const original = fs.readFileSync(settings, "utf8");
const env = parse(original);
function valid(plan) {
  return (
    /^plan_[a-zA-Z0-9]+$/.test(plan?.id || "") &&
    plan.period === "monthly" &&
    plan.interval === 1 &&
    plan.item?.amount === 79900 &&
    plan.item?.currency === "INR"
  );
}
async function api(endpoint, method = "GET", body) {
  const response = await fetch("https://api.razorpay.com/v1/" + endpoint, {
    method,
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          env.RAZORPAY_KEY_ID + ":" + env.RAZORPAY_KEY_SECRET,
        ).toString("base64"),
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok)
    throw Error(
      "Razorpay Test Mode request failed (HTTP " +
        response.status +
        "). No response or credential values displayed.",
    );
  return response.json();
}
function save(plan) {
  if (!valid(plan))
    throw Error(
      "Provider plan does not match INR 799/month; no local configuration changed.",
    );
  const current = fs.readFileSync(settings, "utf8");
  const now = parse(current);
  if (
    now.RAZORPAY_KEY_ID !== env.RAZORPAY_KEY_ID ||
    now.RAZORPAY_KEY_SECRET !== env.RAZORPAY_KEY_SECRET
  )
    throw Error(
      "Staging keys changed during validation. Plan result retained for review; no environment edit made.",
    );
  if (now.RAZORPAY_PLAN_ID && now.RAZORPAY_PLAN_ID !== plan.id)
    throw Error(
      "A different plan ID was entered during setup. Refusing to overwrite it.",
    );
  if (!/^RAZORPAY_PLAN_ID=.*$/m.test(current))
    throw Error("Missing plan field in local environment template.");
  fs.writeFileSync(
    settings,
    current.replace(/^RAZORPAY_PLAN_ID=.*$/m, "RAZORPAY_PLAN_ID=" + plan.id),
  );
  fs.writeFileSync(
    receipt,
    JSON.stringify(
      {
        state: "complete",
        planId: plan.id,
        keyFingerprint: crypto
          .createHash("sha256")
          .update(env.RAZORPAY_KEY_ID)
          .digest("hex"),
        verifiedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    "Verified Razorpay TEST plan: INR 799, every 1 month. Saved its ID in ignored frontend.env. No subscription or payment created; secrets not displayed.",
  );
}
async function main() {
  if (
    !/^rzp_test_[a-zA-Z0-9]+$/.test(env.RAZORPAY_KEY_ID || "") ||
    !env.RAZORPAY_KEY_SECRET
  )
    throw Error(
      "Valid Test Mode key ID and secret are required. LIVE keys are refused before any request.",
    );
  if (env.RAZORPAY_PLAN_ID) {
    if (!/^plan_[a-zA-Z0-9]+$/.test(env.RAZORPAY_PLAN_ID))
      throw Error("Invalid plan ID format");
    save(await api("plans/" + env.RAZORPAY_PLAN_ID));
    return;
  }
  const prior = fs.existsSync(receipt)
    ? JSON.parse(fs.readFileSync(receipt, "utf8"))
    : null;
  const fingerprint = crypto
    .createHash("sha256")
    .update(env.RAZORPAY_KEY_ID)
    .digest("hex");
  if (
    ["complete", "created"].includes(prior?.state) &&
    prior.keyFingerprint === fingerprint &&
    /^plan_[a-zA-Z0-9]+$/.test(prior.planId)
  ) {
    save(await api("plans/" + prior.planId));
    return;
  }
  for (let skip = 0; skip < 1000; skip += 100) {
    const page = await api("plans?count=100&skip=" + skip);
    if (!Array.isArray(page.items))
      throw Error("Unexpected provider plan listing");
    const plan = page.items.find(
      (p) => valid(p) && p.notes?.axon_environment === "local-staging",
    );
    if (plan) {
      save(plan);
      return;
    }
    if (page.items.length < 100) break;
  }
  if (prior?.state === "pending")
    throw Error(
      "An earlier test-plan create result is uncertain. Review the Test Mode plan list before creating another; no automatic POST repeated.",
    );
  const operationId = crypto.randomUUID();
  fs.writeFileSync(
    receipt,
    JSON.stringify(
      {
        state: "pending",
        operationId,
        keyFingerprint: fingerprint,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  const plan = await api("plans", "POST", {
    period: "monthly",
    interval: 1,
    item: {
      name: "Axon Pro — LOCAL STAGING",
      amount: 79900,
      currency: "INR",
      description: "Test only: 5,000 validations per billing period",
    },
    notes: { axon_environment: "local-staging", operation_id: operationId },
  });
  // Retain the recoverable provider reference even if a concurrent local edit prevents saving.
  fs.writeFileSync(
    receipt,
    JSON.stringify(
      {
        state: "created",
        planId: plan.id,
        operationId,
        keyFingerprint: fingerprint,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  save(plan);
}
main().catch((error) => {
  console.error(
    error.name === "TimeoutError"
      ? "Provider timeout: creation may be pending. Review the saved operation before retrying."
      : error.message,
  );
  process.exitCode = 1;
});

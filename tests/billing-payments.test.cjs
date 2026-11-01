/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS VM harness tests the server modules without live providers. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");

function fixture(options = {}) {
  const now = Math.floor(Date.now() / 1000);
  const metadata = { ...options.metadata };
  const calls = [];
  const subscription = {
    id: "sub_fixture",
    plan_id: "plan_current",
    status: "active",
    paid_count: 1,
    current_start: now - 100,
    current_end: now + 2500000,
    notes: { clerk_user_id: "user_fixture" },
    ...options.subscription,
  };
  const clerk = {
    users: {
      getUser: async () => ({
        privateMetadata: metadata,
        primaryEmailAddress: { emailAddress: "test@example.com" },
      }),
      updateUserMetadata: async (id, data) => {
        Object.assign(metadata, data.privateMetadata);
        calls.push({ type: "metadata", data });
      },
    },
  };
  const cache = {};
  const events = new Map();
  let checkoutStarted = false;
  const database = {
    query: async (sql, values = []) => {
      if (sql.includes("take_rate_limit")) return [{ allowed: true }];
      if (sql.includes("axon_apply_billing")) {
        if (options.backendFailure) throw Error("Database unavailable");
        calls.push({
          type: "billing",
          body: {
            user_id: values[0],
            plan: values[1],
            period_start: Date.parse(values[2]) / 1000,
            period_end: Date.parse(values[3]) / 1000,
            occurred_at: Date.parse(values[4]) / 1000,
            request_limit: values[1] === "pro" ? 5000 : 100,
          },
        });
        return [{ data: { success: true, ignored: !!options.ignored } }];
      }
      if (sql.includes("axon_account_quota")) {
        const u =
          "usageResponse" in options ? options.usageResponse : { plan: "pro" };
        return u && typeof u === "object" && !Array.isArray(u)
          ? [
              {
                ...u,
                free_used: 0,
                paid_used: 0,
                custom_limit: 0,
                period_active: true,
              },
            ]
          : [];
      }
      if (sql.startsWith("INSERT INTO axon_security.webhook_events")) {
        if (events.has(values[0])) return [];
        events.set(values[0], { body_hash: values[1], state: "processing" });
        return [{ event_id: values[0] }];
      }
      if (sql.startsWith("SELECT body_hash,state"))
        return [events.get(values[0])];
      if (sql.includes("webhook_events SET state='completed'")) {
        events.get(values[0]).state = "completed";
        return [];
      }
      if (sql.startsWith("INSERT INTO axon_security.checkout_operations")) {
        if (checkoutStarted) return [];
        checkoutStarted = true;
        return [{ operation_id: "operation" }];
      }
      if (sql.startsWith("SELECT * FROM axon_security.checkout_operations"))
        return options.savedCheckout ? [options.savedCheckout] : [];
      if (sql.includes("checkout_operations")) return [];
      if (sql.includes("webhook_events")) return [];
      throw Error("Unexpected database query: " + sql);
    },
  };
  const mockFetch = async (url, init = {}) => {
    calls.push({
      type: "fetch",
      url,
      body: init.body && JSON.parse(init.body),
      method: init.method || "GET",
    });
    if (url.endsWith("/webhook/usage")) {
      const data =
        "usageResponse" in options
          ? options.usageResponse
          : {
              plan: "pro",
              request_limit: 5000,
              monthly_requests: 0,
              remaining: 5000,
            };
      return { ok: true, status: 200, text: async () => JSON.stringify(data) };
    }
    if (url.endsWith("/cancel"))
      return { ok: !options.cancelFailure, json: async () => subscription };
    if (url.includes("/v1/subscriptions/"))
      return { ok: true, json: async () => subscription };
    if (url.endsWith("/webhook/billing-update"))
      return {
        ok: !options.backendFailure,
        status: options.backendFailure ? 401 : 200,
        json: async () => ({ success: true, ignored: !!options.ignored }),
      };
    if (url.includes("/v1/plans/"))
      return {
        ok: true,
        json: async () => ({
          period: "monthly",
          interval: 1,
          item: { currency: "INR", amount: 79900 },
        }),
      };
    if (url.includes("/v1/invoices?"))
      return { ok: true, json: async () => ({ items: [] }) };
    if (url.endsWith("/v1/subscriptions"))
      return { ok: true, json: async () => ({ id: "sub_new" }) };
    throw Error("Unexpected network call: " + url);
  };
  function load(path) {
    if (cache[path]) return cache[path];
    const exports = {};
    cache[path] = exports;
    const source = ts.transpileModule(fs.readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText;
    const context = {
      exports,
      Buffer,
      AbortSignal,
      URL,
      TextDecoder,
      setTimeout,
      clearTimeout,
      Request,
      console: { error: () => {} },
      process: {
        env: {
          AXON_API_URL: "https://backend.example",
          AXON_SIGNUP_SECRET: "test_signup",
          RAZORPAY_KEY_ID: "test_key",
          RAZORPAY_KEY_SECRET: "test_secret",
          RAZORPAY_PLAN_ID: "plan_current",
          RAZORPAY_WEBHOOK_SECRET: "test_webhook",
          ...options.env,
        },
      },
      fetch: mockFetch,
      require(name) {
        if (name === "server-only") return {};
        if (name === "@/lib/db") return database;
        if (name === "next/server")
          return {
            NextResponse: {
              json: (body, opts) => ({ body, status: opts?.status || 200 }),
            },
          };
        if (name === "@clerk/nextjs/server")
          return {
            auth: async () => ({
              userId: options.signedOut ? null : "user_fixture",
            }),
            clerkClient: async () => clerk,
          };
        if (name === "@/lib/axon") return load("lib/axon.ts");
        if (name === "@/lib/razorpay") return load("lib/razorpay.ts");
        if (name === "@/lib/plans") return load("lib/plans.ts");
        if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
        return require(name);
      },
    };
    vm.runInNewContext(source, context, { filename: path });
    return exports;
  }
  const post = async (body = {}) =>
    load("app/webhook/razorpay-verify/route.ts").POST(
      new Request("https://axon.example/webhook/razorpay-verify", {
        method: "POST",
        headers: {
          origin: "https://axon.example",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
  return { post, load, calls, metadata, subscription, now };
}

test("signed checkout persists verified billing dates before metadata updates", async () => {
  const f = fixture();
  const signature = crypto
    .createHmac("sha256", "test_secret")
    .update("pay_fixture|sub_fixture")
    .digest("hex");
  const result = await f.post({
    razorpay_subscription_id: "sub_fixture",
    razorpay_payment_id: "pay_fixture",
    razorpay_signature: signature,
  });
  assert.equal(result.body.success, true);
  const index = f.calls.findIndex((c) => c.type === "billing");
  assert.equal(f.calls[index].body.period_start, f.subscription.current_start);
  assert.equal(f.calls[index].body.period_end, f.subscription.current_end);
  assert.equal(f.calls[index].body.request_limit, 5000);
  assert.equal(typeof f.calls[index].body.occurred_at, "number");
  assert(
    f.calls.findIndex((c) => c.data?.privateMetadata.axonPlan === "pro") >
      index,
  );
});
test("database failure retains pending subscription and never marks account Pro", async () => {
  const f = fixture({ backendFailure: true });
  const result = await f.post({ subscriptionId: "sub_fixture" });
  assert.equal(result.status, 503);
  assert.equal(result.body.code, "BILLING_SYNC_PENDING");
  assert.equal(f.metadata.axonPlan, undefined);
  assert.equal(f.metadata.razorpayPendingSubscriptionId, "sub_fixture");
});
test("activation retry uses saved subscription without creating a payment", async () => {
  const f = fixture({
    metadata: { razorpayPendingSubscriptionId: "sub_fixture" },
  });
  const result = await f.post();
  assert.equal(result.body.success, true);
  assert.equal(f.metadata.razorpaySubscriptionId, "sub_fixture");
  assert(
    !f.calls.some(
      (c) => c.method === "POST" && c.url?.includes("api.razorpay.com"),
    ),
  );
});
test("reject another user subscription without changing billing", async () => {
  const f = fixture({
    subscription: { notes: { clerk_user_id: "someone_else" } },
  });
  const result = await f.post({ subscriptionId: "sub_fixture" });
  assert.equal(result.status, 403);
  assert(!f.calls.some((c) => c.type === "billing"));
});
test("invalid signature cannot activate an owned subscription", async () => {
  const f = fixture();
  const result = await f.post({
    razorpay_subscription_id: "sub_fixture",
    razorpay_payment_id: "pay_fixture",
    razorpay_signature: "0".repeat(64),
  });
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "SIGNATURE_INVALID");
  assert.equal(f.metadata.axonPlan, undefined);
});
for (const [label, subscription] of [
  ["unpaid", { paid_count: 0 }],
  ["inactive", { status: "authenticated" }],
  ["missing dates", { current_start: null, current_end: null }],
  ["legacy plan", { plan_id: "plan_legacy" }],
]) {
  test(label + " never grants new Pro quota", async () => {
    const f = fixture({ subscription });
    const result = await f.post({ subscriptionId: "sub_fixture" });
    assert.equal(result.status, 503);
    assert.equal(f.metadata.axonPlan, undefined);
  });
}
test("ignored backend update is pending, not a false success", async () => {
  const f = fixture({ ignored: true });
  const result = await f.post({ subscriptionId: "sub_fixture" });
  assert.equal(result.status, 202);
  assert.equal(result.body.success, undefined);
  assert.equal(f.metadata.axonPlan, undefined);
});
test("existing paid subscription prevents another checkout", async () => {
  const f = fixture({
    metadata: { razorpayPendingSubscriptionId: "sub_fixture" },
  });
  const result = await f.load("app/webhook/razorpay-subscribe/route.ts").POST(
    new Request("https://axon.example/webhook/razorpay-subscribe", {
      method: "POST",
      headers: { origin: "https://axon.example" },
    }),
  );
  assert.equal(result.status, 409);
  assert.equal(result.body.code, "SUBSCRIPTION_EXISTS");
  assert(
    !f.calls.some(
      (c) => c.method === "POST" && c.url?.includes("api.razorpay.com"),
    ),
  );
});
test("missing recovery ID asks for subscription reference without charging", async () => {
  const f = fixture();
  const result = await f.post();
  assert.equal(result.status, 400);
  assert.equal(result.body.code, "SUBSCRIPTION_REQUIRED");
  assert.equal(f.calls.length, 0);
});

async function webhook(f, event, valid = true) {
  const raw = JSON.stringify({
    event,
    created_at: f.now,
    payload: {
      subscription: {
        entity: { id: "sub_fixture", notes: { clerk_user_id: "user_fixture" } },
      },
    },
  });
  const signature = valid
    ? crypto.createHmac("sha256", "test_webhook").update(raw).digest("hex")
    : "invalid";
  return f.load("app/webhook/razorpay/route.ts").POST(
    new Request("https://axon.example/webhook/razorpay", {
      method: "POST",
      headers: { "x-razorpay-signature": signature },
      body: raw,
    }),
  );
}
test("signed renewal syncs billing dates and saves the recoverable subscription", async () => {
  const f = fixture();
  const result = await webhook(f, "subscription.charged");
  assert.equal(result.status, 200);
  assert.equal(f.metadata.razorpaySubscriptionId, "sub_fixture");
  assert.equal(
    f.calls.find((c) => c.type === "billing").body.period_start,
    f.subscription.current_start,
  );
});
test("delayed cancellation uses current active provider state", async () => {
  const f = fixture();
  await webhook(f, "subscription.cancelled");
  assert.equal(f.calls.find((c) => c.type === "billing").body.plan, "pro");
});
test("cancellation of a different subscription cannot downgrade the current one", async () => {
  const f = fixture({
    metadata: { razorpaySubscriptionId: "sub_newer" },
    subscription: { status: "cancelled" },
  });
  await webhook(f, "subscription.cancelled");
  assert(!f.calls.some((c) => c.type === "billing"));
});
test("unsigned webhook makes no provider or backend requests", async () => {
  const f = fixture();
  const result = await webhook(f, "subscription.charged", false);
  assert.equal(result.status, 401);
  assert.equal(f.calls.length, 0);
});

const cancel = (f, body = { subscriptionId: "sub_fixture", confirmed: true }) =>
  f.load("app/webhook/razorpay-cancel/route.ts").POST(
    new Request("https://axon.example/webhook/razorpay-cancel", {
      method: "POST",
      headers: {
        origin: "https://axon.example",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
test("cancellation requires sign-in and explicit confirmation", async () => {
  const signedOut = fixture({ signedOut: true });
  assert.equal((await cancel(signedOut)).status, 401);
  assert.equal(signedOut.calls.length, 0);
  const f = fixture();
  assert.equal(
    (await cancel(f, { subscriptionId: "sub_fixture" })).status,
    400,
  );
  assert.equal(f.calls.length, 0);
});
test("cancel renewal uses end-of-cycle and preserves paid entitlement", async () => {
  const f = fixture({
    metadata: { axonPlan: "pro", razorpaySubscriptionId: "sub_fixture" },
  });
  const result = await cancel(f);
  assert.equal(result.body.success, true);
  assert.equal(result.body.effectiveAt, f.subscription.current_end);
  const request = f.calls.find((c) => c.url?.endsWith("/cancel"));
  assert.equal(request.method, "POST");
  assert.equal(request.body.cancel_at_cycle_end, true);
  assert.equal(f.metadata.axonPlan, "pro");
  assert(!f.calls.some((c) => c.type === "billing"));
});
test("another user cannot cancel a subscription", async () => {
  const f = fixture({
    subscription: { notes: { clerk_user_id: "someone_else" } },
  });
  const result = await cancel(f);
  assert.equal(result.status, 403);
  assert(!f.calls.some((c) => c.url?.endsWith("/cancel")));
});
test("scheduled cancellation repeated does not send another cancellation", async () => {
  const f = fixture();
  await cancel(f);
  await cancel(f);
  assert.equal(f.calls.filter((c) => c.url?.endsWith("/cancel")).length, 1);
});
test("provider failure never reports cancellation success", async () => {
  const f = fixture({ cancelFailure: true });
  const result = await cancel(f);
  assert.equal(result.status, 503);
  assert.equal(f.metadata.razorpayCancellation, undefined);
});
test("legacy paid subscriptions can also stop renewal", async () => {
  const f = fixture({ subscription: { plan_id: "plan_legacy" } });
  assert.equal((await cancel(f)).body.success, true);
});
test("already cancelled subscription returns without another provider mutation", async () => {
  const f = fixture({ subscription: { status: "cancelled" } });
  const result = await cancel(f);
  assert.equal(result.body.alreadyCancelled, true);
  assert(!f.calls.some((c) => c.url?.endsWith("/cancel")));
});
test("scheduled cancellation remains visible after a page reload", async () => {
  const f = fixture({ metadata: { razorpaySubscriptionId: "sub_fixture" } });
  await cancel(f);
  const result = await f
    .load("app/webhook/subscription/route.ts")
    .GET({ url: "https://axon.example/webhook/subscription" });
  assert.equal(result.body.subscription.cancellationScheduled, true);
  assert.equal(result.body.subscription.canCancel, false);
});

test("usage exposes the authoritative Pro plan", async () => {
  const f = fixture({ metadata: { axonApiKey: "test_key" } });
  const result = await f
    .load("app/webhook/usage/route.ts")
    .GET(new Request("https://axon.example/webhook/usage"));
  assert.equal(result.body.plan, "pro");
  assert.equal(result.body.request_limit, 5000);
});
for (const data of [
  [],
  null,
  { request_limit: 5000 },
  { plan: "unknown", request_limit: 5000 },
]) {
  test(
    "missing or invalid backend plan never becomes a fake Free plan: " +
      JSON.stringify(data),
    async () => {
      const f = fixture({
        metadata: { axonApiKey: "test_key" },
        usageResponse: data,
      });
      const result = await f
        .load("app/webhook/usage/route.ts")
        .GET(new Request("https://axon.example/webhook/usage"));
      assert.equal(result.status, 503);
      assert.equal(result.body.plan, undefined);
    },
  );
}

test("a completed signed webhook replay does not repeat provider or entitlement work", async () => {
  const f = fixture();
  await webhook(f, "subscription.charged");
  const before = f.calls.length;
  const again = await webhook(f, "subscription.charged");
  assert.equal(again.body.duplicate, true);
  assert.equal(f.calls.length, before);
});

test("checkout refuses an uninitialized account before any provider call", async () => {
  const f = fixture({ usageResponse: null });
  const r = await f.load("app/webhook/razorpay-subscribe/route.ts").POST(
    new Request("https://axon.example/webhook/razorpay-subscribe", {
      method: "POST",
      headers: { origin: "https://axon.example" },
    }),
  );
  assert.equal(r.status, 503);
  assert.equal(f.calls.length, 0);
});
test("simultaneous free-account checkouts create one intended provider subscription", async () => {
  const f = fixture({ usageResponse: { plan: "free" } });
  const create = () =>
    f.load("app/webhook/razorpay-subscribe/route.ts").POST(
      new Request("https://axon.example/webhook/razorpay-subscribe", {
        method: "POST",
        headers: { origin: "https://axon.example" },
      }),
    );
  const results = await Promise.all([create(), create()]);
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.equal(
    f.calls.filter(
      (c) =>
        c.method === "POST" &&
        c.url === "https://api.razorpay.com/v1/subscriptions",
    ).length,
    1,
  );
});

test("unconfigured checkout returns a clear 503 without provider calls or checkout creation", async () => {
  const f = fixture({
    usageResponse: { plan: "free" },
    env: { RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "", RAZORPAY_PLAN_ID: "" },
  });
  const r = await f
    .load("app/webhook/razorpay-subscribe/route.ts")
    .POST(
      new Request("https://axon.example/webhook/razorpay-subscribe", {
        method: "POST",
        headers: { origin: "https://axon.example" },
      }),
    );
  assert.equal(r.status, 503);
  assert.equal(r.body.code, "PAYMENTS_UNAVAILABLE");
  assert.match(r.body.error, /No payment has been taken/);
  assert.equal(f.calls.filter((c) => c.type === "fetch").length, 0);
});

test("a free account without a subscription has empty history even with payments disabled", async () => {
  const f = fixture({ env: { RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "" } });
  const r = await f.load("app/webhook/billing-history/route.ts").GET();
  assert.equal(r.status, 200);
  assert.equal(r.body.invoices.length, 0);
  assert.equal(f.calls.filter((c) => c.type === "fetch").length, 0);
});

test("history uses a durable subscription when the Clerk metadata copy is absent", async () => {
  const f = fixture({ savedCheckout: { subscription_id: "sub_durable" } });
  const r = await f.load("app/webhook/billing-history/route.ts").GET();
  assert.equal(r.status, 200);
  assert(
    f.calls.some(
      (c) =>
        c.type === "fetch" && c.url.includes("subscription_id=sub_durable"),
    ),
  );
});

test("existing subscription history fails visibly when provider credentials are absent", async () => {
  const f = fixture({
    savedCheckout: { subscription_id: "sub_durable" },
    env: { RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "" },
  });
  const r = await f.load("app/webhook/billing-history/route.ts").GET();
  assert.equal(r.status, 503);
  assert.equal(r.body.code, "PAYMENTS_UNAVAILABLE");
  assert.equal(f.calls.filter((c) => c.type === "fetch").length, 0);
});

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict"),
  { Client } = require("pg"),
  { createClerkClient } = require("@clerk/backend");
const root = path.resolve(__dirname, ".."),
  local = path.join(root, ".cache/staging");
function env(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => {
        const i = l.indexOf("=");
        return [
          l.slice(0, i),
          l
            .slice(i + 1)
            .trim()
            .replace(/^(["'])(.*)\1$/, "$2"),
        ];
      }),
  );
}
const settings = env(path.join(local, "frontend.env")),
  dbSettings = env(path.join(local, ".env"));
if (
  !settings.CLERK_SECRET_KEY?.startsWith("sk_test_") ||
  !settings.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")
)
  throw Error("Dedicated development Clerk keys required");
const clerk = createClerkClient({
  secretKey: settings.CLERK_SECRET_KEY,
  publishableKey: settings.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});
const db = new Client({
  host: "127.0.0.1",
  port: 55432,
  database: "axon_staging",
  user: "axon_staging_admin",
  password: dbSettings.STAGING_DB_PASSWORD,
  connectionTimeoutMillis: 10000,
  statement_timeout: 10000,
});
const users = [],
  actors = [],
  checks = [],
  base = "http://localhost:3101";
async function call(actor, route, body) {
  const response = await fetch(base + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: "Bearer " + actor.token,
      ...(body === undefined
        ? {}
        : { Origin: base, "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error("Unexpected staging response: HTTP " + response.status);
  }
  return { status: response.status, data };
}
function pass(name) {
  checks.push(name);
  console.log("PASS " + name);
}
async function main() {
  await db.connect();
  try {
    for (let i = 0; i < 2; i++) {
      const user = await clerk.users.createUser({
        emailAddress: [
          "axon-isolation-" + crypto.randomUUID() + "+clerk_test@example.com",
        ],
        skipPasswordRequirement: true,
        firstName: "Synthetic",
        lastName: "Isolation",
      });
      users.push(user.id);
      const session = await clerk.sessions.createSession({ userId: user.id }),
        token = await clerk.sessions.getToken(session.id);
      const actor = { user: user.id, session: session.id, token: token.jwt };
      actors.push(actor);
      const provisioned = await call(actor, "/webhook/create-api-key", {});
      assert.equal(provisioned.status, 200);
      assert(provisioned.data.apiKey);
      pass("real development session provisions its own key");
      const key = (
        await db.query("SELECT id FROM public.api_keys WHERE user_id=$1", [
          user.id,
        ])
      ).rows[0];
      actor.keyId = Number(key.id);
      await db.query(
        "UPDATE public.axon_account_quota SET free_used=$2 WHERE user_id=$1",
        [user.id, i ? 22 : 11],
      );
      const row = (
        await db.query(
          "INSERT INTO public.validation_logs(user_id,agent_id,action_type,final_verdict,reason,timestamp) VALUES($1,$2,'api_call','BLOCK',$3,now()) RETURNING id",
          [user.id, "actor-" + i, "synthetic-only-" + i],
        )
      ).rows[0];
      actor.alertId = Number(row.id);
    }
    for (const [index, actor] of [actors[0], actors[1], actors[0]].entries()) {
      const ownerIndex = actor === actors[0] ? 0 : 1;
      const usage = await call(actor, "/webhook/usage");
      assert.equal(usage.status, 200);
      assert.equal(usage.data.monthly_requests, ownerIndex ? 22 : 11);
      const logs = await call(actor, "/webhook/logs");
      assert.equal(logs.status, 200);
      assert.equal(logs.data.logs.length, 1);
      assert.equal(logs.data.logs[0].agentId, "actor-" + ownerIndex);
      const keys = await call(actor, "/webhook/api-keys");
      assert.equal(keys.status, 200);
      assert.equal(keys.data.keys.length, 1);
      assert.equal(keys.data.keys[0].id, actor.keyId);
      pass("session switch " + index + " returns only its owner data");
    }
    assert.equal(
      (await call(actors[0], "/webhook/revoke-key", { keyId: actors[1].keyId }))
        .status,
      404,
    );
    pass("cross-account revocation denied");
    assert.equal(
      (
        await call(actors[0], "/webhook/alerts", {
          alertId: actors[1].alertId,
          reviewed: true,
        })
      ).status,
      404,
    );
    pass("cross-account review denied");
    assert.equal(
      (
        await call(actors[1], "/webhook/alerts", {
          alertId: actors[1].alertId,
          reviewed: true,
        })
      ).status,
      200,
    );
    assert(
      (
        await call(actors[1], "/webhook/alerts?filter=Reviewed")
      ).data.alerts.some((a) => a.id === String(actors[1].alertId)),
    );
    pass("owner review persists across authenticated reload");
    fs.writeFileSync(
      path.join(local, "session-isolation-result.json"),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          synthetic: true,
          realClerkDevelopmentSessions: true,
          checks,
          productionTouched: false,
          browserCacheSwitchTested: false,
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    for (const actor of actors)
      await clerk.sessions.revokeSession(actor.session).catch(() => {});
    for (const table of [
      "axon_security.alert_reviews",
      "public.validation_logs",
      "public.axon_quota_reservation",
      "public.api_keys",
      "public.axon_account_quota",
    ])
      if (users.length)
        await db.query(
          "DELETE FROM " + table + " WHERE user_id=ANY($1::text[])",
          [users],
        );
    for (const id of users) await clerk.users.deleteUser(id);
    await db.end();
  }
}
main().catch((e) => {
  console.error(
    "Staging session test stopped:",
    e.code || e.name,
    e.status || "",
  );
  process.exitCode = 1;
});

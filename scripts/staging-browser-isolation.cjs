/* eslint-disable @typescript-eslint/no-require-imports */
// Real browser acceptance using only the dedicated development identity app and localhost DB.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const root = process.cwd(),
  local = path.join(root, ".cache/staging");
process.env.TEMP = path.join(local, "browser-temp");
process.env.TMP = process.env.TEMP;
fs.mkdirSync(process.env.TEMP, { recursive: true });
const { chromium } = require(
  path.join(
    root,
    ".cache/tools/browser-acceptance/node_modules/@playwright/test",
  ),
);
const { clerk, clerkSetup } = require(
  path.join(
    root,
    ".cache/tools/browser-acceptance/node_modules/@clerk/testing/playwright",
  ),
);
const { createClerkClient } = require("@clerk/backend"),
  { Client } = require("pg");
function env(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((x) => /^[A-Z0-9_]+=/.test(x))
      .map((x) => {
        const i = x.indexOf("=");
        return [
          x.slice(0, i),
          x
            .slice(i + 1)
            .trim()
            .replace(/^(["'])(.*)\1$/, "$2"),
        ];
      }),
  );
}
const e = env(path.join(local, "frontend.env")),
  s = env(path.join(local, ".env"));
assert(
  e.CLERK_SECRET_KEY?.startsWith("sk_test_") &&
    e.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_"),
  "Dedicated development keys required",
);
process.env.CLERK_SECRET_KEY = e.CLERK_SECRET_KEY;
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
  e.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const api = createClerkClient({
  secretKey: e.CLERK_SECRET_KEY,
  publishableKey: e.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
});
const db = new Client({
  host: "127.0.0.1",
  port: 55432,
  database: "axon_staging",
  user: "axon_staging_admin",
  password: s.STAGING_DB_PASSWORD,
  connectionTimeoutMillis: 10000,
  statement_timeout: 10000,
});
let browser,
  stage = "setup",
  connected = false;
const actors = [],
  checks = [];
const pass = (x) => {
  checks.push(x);
  console.log("PASS " + x);
};
async function main() {
  try {
    await db.connect();
    connected = true;
    assert.equal(
      (await db.query("SELECT current_database() AS name")).rows[0].name,
      "axon_staging",
    );
    for (let i = 0; i < 2; i++) {
      stage = "create-synthetic-actor";
      const email =
        "axon-browser-" + crypto.randomUUID() + "+clerk_test@example.com";
      const u = await api.users.createUser({
        emailAddress: [email],
        skipPasswordRequirement: true,
        firstName: "Browser",
        lastName: i ? "Beta" : "Alpha",
      });
      const marker =
        "browser-actor-" + i + "-" + crypto.randomUUID().slice(0, 8);
      actors.push({ id: u.id, email, marker });
      await db.query(
        "INSERT INTO public.axon_account_quota(user_id,plan,free_used) VALUES($1,'free',$2)",
        [u.id, i ? 22 : 11],
      );
      await db.query(
        "INSERT INTO public.validation_logs(user_id,agent_id,action_type,final_verdict,reason,timestamp) VALUES($1,$2,'api_call','BLOCK','Synthetic browser acceptance only',now())",
        [u.id, marker],
      );
    }
    stage = "clerk-testing-setup";
    await clerkSetup({
      dotenv: false,
      secretKey: e.CLERK_SECRET_KEY,
      publishableKey: e.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    });
    stage = "browser-launch";
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 950 },
      }),
      page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(60000);
    for (const [n, i] of [0, 1, 0].entries()) {
      stage = "browser-sign-in-" + n;
      await page.goto("http://localhost:3101/", {
        waitUntil: "domcontentloaded",
      });
      await clerk.signIn({ page, emailAddress: actors[i].email });
      stage = "dashboard-render-" + n;
      await page.goto("http://localhost:3101/dashboard/logs", {
        waitUntil: "domcontentloaded",
      });
      await page
        .getByText(actors[i].marker, { exact: true })
        .waitFor({ state: "visible" });
      const save = page.getByRole("button", {
        name: "I saved my key",
        exact: true,
      });
      if (await save.isVisible()) await save.click();
      assert(
        !(await page.locator("body").innerText()).includes(
          actors[1 - i].marker,
        ),
        "Other account marker visible",
      );
      pass("browser account " + n + " renders only its own logs");
      // Check every painted frame after ownership has resolved for lingering prior-account content.
      const leaked = await page.evaluate(
        async ({ other }) => {
          let leaked = false;
          for (let n = 0; n < 60; n++) {
            await new Promise(requestAnimationFrame);
            if (document.body.innerText.includes(other)) leaked = true;
          }
          return leaked;
        },
        { other: actors[1 - i].marker },
      );
      assert.equal(leaked, false);
      pass(
        "browser account " +
          n +
          " has no stale other-account content over 60 frames",
      );
      if (n === 2) {
        await page.screenshot({
          path: path.join(local, "browser-isolation.png"),
          fullPage: true,
        });
      }
      stage = "browser-sign-out-" + n;
      await page.locator('button[title="Sign out"]:visible').first().click();
      await page.waitForURL((u) => !u.pathname.startsWith("/dashboard"));
      assert(
        !(await page.locator("body").innerText()).includes(actors[i].marker),
      );
      pass("browser sign-out " + n + " clears protected content");
    }
    fs.writeFileSync(
      path.join(local, "browser-isolation-result.json"),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          browser: "headless installed Chrome",
          realBrowser: true,
          developmentOnly: true,
          checks,
          productionTouched: false,
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
  } finally {
    if (browser) await browser.close();
    if (connected) {
      for (const t of [
        "axon_security.alert_reviews",
        "public.validation_logs",
        "public.axon_quota_reservation",
        "public.api_keys",
        "public.axon_account_quota",
      ])
        if (actors.length)
          await db.query(
            "DELETE FROM " + t + " WHERE user_id=ANY($1::text[])",
            [actors.map((a) => a.id)],
          );
      await db.end();
    }
    for (const a of actors) await api.users.deleteUser(a.id);
  }
}
main().catch((e) => {
  console.error(
    JSON.stringify({
      message: "Browser acceptance stopped; no credentials logged",
      stage,
      error: e.code || e.name,
    }),
  );
  process.exitCode = 1;
});

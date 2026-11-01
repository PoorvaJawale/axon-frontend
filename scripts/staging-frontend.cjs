/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const local = path.join(root, ".cache/staging");
const settings = path.join(local, "frontend.env");
const allowed = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_PLAN_ID",
  "RAZORPAY_WEBHOOK_SECRET",
];
function readEnv(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => {
        const i = line.indexOf("=");
        let value = line.slice(i + 1).trim();
        if (value.startsWith('"') || value.startsWith("'")) {
          if (value.length < 2 || value.at(-1) !== value[0])
            throw Error(
              "Unclosed quote in environment field " + line.slice(0, i),
            );
          value = value.slice(1, -1);
        }
        return [line.slice(0, i), value];
      }),
  );
}
function prepare() {
  fs.mkdirSync(local, { recursive: true });
  if (!fs.existsSync(settings))
    fs.writeFileSync(
      settings,
      "# LOCAL STAGING ONLY. Do not paste keys in chat or commit this file.\n# Use a separate Clerk development application, not the app used by the live site.\nNEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=\nCLERK_SECRET_KEY=\n\n# Leave all payment fields blank to disable payments. Only rzp_test_ keys are accepted.\n# Create a separate INR monthly test plan for 79900 paise.\nRAZORPAY_KEY_ID=\nRAZORPAY_KEY_SECRET=\nRAZORPAY_PLAN_ID=\nRAZORPAY_WEBHOOK_SECRET=\n",
      { mode: 0o600, flag: "wx" },
    );
}
try {
  const action = process.argv[2] || "start";
  if (!["prepare", "check", "start"].includes(action))
    throw Error("Use prepare, check or start.");
  prepare();
  if (process.argv[2] === "prepare") {
    console.log(
      "Created/preserved ignored .cache/staging/frontend.env. No provider keys generated or displayed.",
    );
  } else {
    const config = readEnv(settings);
    if (Object.keys(config).some((key) => !allowed.includes(key)))
      throw Error(
        "Unexpected setting in staging frontend.env; use only the template fields.",
      );
    if (
      !config.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") ||
      !config.CLERK_SECRET_KEY?.startsWith("sk_test_")
    )
      throw Error(
        "Separate Clerk development application keys are required in .cache/staging/frontend.env.",
      );
    // Do not silently reuse the existing site's known auth application and mutate its metadata.
    const existingKeys = [];
    for (const file of [
      ".env",
      ".env.local",
      ".env.development",
      ".env.development.local",
    ]) {
      if (fs.existsSync(path.join(root, file)))
        existingKeys.push(
          readEnv(path.join(root, file)).NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        );
    }
    try {
      existingKeys.push(
        JSON.parse(
          fs.readFileSync(path.join(root, ".clerk/.tmp/keyless.json"), "utf8"),
        ).publishableKey,
      );
    } catch {
      /* No cached auth app. */
    }
    if (existingKeys.includes(config.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY))
      throw Error(
        "Staging must use a separate Clerk application; this key matches the existing site's auth configuration.",
      );
    const payment = allowed.filter(
      (k) =>
        k.startsWith("RAZORPAY_") &&
        k !== "RAZORPAY_WEBHOOK_SECRET" &&
        config[k],
    );
    if (
      payment.length &&
      (payment.length !== 3 ||
        !config.RAZORPAY_WEBHOOK_SECRET ||
        !config.RAZORPAY_KEY_ID.startsWith("rzp_test_") ||
        !config.RAZORPAY_PLAN_ID.startsWith("plan_"))
    )
      throw Error(
        "Configure all four Razorpay fields with TEST MODE keys/plan, or leave API key and plan fields blank to keep payments disabled.",
      );
    const secrets = readEnv(path.join(local, ".env"));
    const env = { ...process.env };
    // Process values take precedence over Next's automatic .env loading. Explicitly
    // blank provider variables so the live project's .env.local cannot fill them in.
    for (const file of fs
      .readdirSync(root)
      .filter(
        (n) =>
          /^\.env(?:\.|$)/.test(n) && fs.statSync(path.join(root, n)).isFile(),
      ))
      for (const key of Object.keys(readEnv(path.join(root, file))))
        env[key] = "";
    for (const key of Object.keys(env))
      if (
        /^(AXON_|CLERK_|NEXT_PUBLIC_|RAZORPAY_|GMAIL_|CONTACT_SALES_)/.test(key)
      )
        env[key] = "";
    for (const key of allowed) env[key] = config[key] || "";
    env.NODE_ENV = "development";
    env.AXON_DATABASE_URL =
      "postgresql://axon_staging_web:" +
      encodeURIComponent(secrets.STAGING_WEB_PASSWORD) +
      "@127.0.0.1:55432/axon_staging?sslmode=disable";
    env.AXON_PUBLIC_SITE_URL = "http://localhost:3101";
    env.TEMP = path.join(root, ".cache/tmp");
    env.TMP = env.TEMP;
    if (process.argv[2] === "check") {
      console.log(
        "Local staging config accepted: separate Clerk test app, local web-role DB, payments " +
          (payment.length ? "TEST MODE" : "disabled") +
          ". No values displayed.",
      );
    } else {
      console.log(
        "Starting isolated frontend at http://localhost:3101; Railway/Gmail/live payment settings excluded.",
      );
      const child = spawn(
        process.execPath,
        [
          require.resolve("next/dist/bin/next"),
          "dev",
          "--webpack",
          "--hostname",
          "localhost",
          "--port",
          "3101",
        ],
        { cwd: root, env, stdio: "inherit" },
      );
      child.on("error", () => {
        console.error("Could not start the staging frontend.");
        process.exitCode = 1;
      });
      child.on("exit", (code) => {
        process.exitCode = code || 0;
      });
      process.on("SIGTERM", () => child.kill("SIGTERM"));
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

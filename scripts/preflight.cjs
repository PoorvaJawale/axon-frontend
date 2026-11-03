/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const required = [
  "AXON_DATABASE_URL",
  "AXON_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_PLAN_ID",
  "RAZORPAY_WEBHOOK_SECRET",
];
let failures = 0;
const publicLaunch = process.argv.includes("--public-launch");
const publishableMode = /^pk_(test|live)_/.exec(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "",
)?.[1];
const secretMode = /^sk_(test|live)_/.exec(
  process.env.CLERK_SECRET_KEY || "",
)?.[1];
if (publishableMode && secretMode && publishableMode !== secretMode) {
  console.error("Clerk public/server key modes must match.");
  failures++;
}
if (publicLaunch) {
  if (publishableMode !== "live" || secretMode !== "live") {
    console.error(
      "Public launch requires paired Clerk production keys after verified identity migration.",
    );
    failures++;
  }
  try {
    const u = new URL(process.env.AXON_PUBLIC_SITE_URL);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash ||
      u.hostname.endsWith(".vercel.app") ||
      ["localhost", "127.0.0.1"].includes(u.hostname)
    )
      throw Error();
  } catch {
    console.error(
      "Public launch requires the configured owned HTTPS domain and completed DNS/identity setup.",
    );
    failures++;
  }
  if (!process.env.RAZORPAY_KEY_ID?.startsWith("rzp_live_")) {
    console.error(
      "Public paid launch requires the reviewed live payment configuration.",
    );
    failures++;
  }
} else if (publishableMode === "test")
  console.log(
    "INFO Clerk development instance; public production identity gate remains open.",
  );
for (const key of required) {
  const set = !!process.env[key];
  console.log((set ? "OK " : "MISSING ") + key);
  if (!set) failures++;
}
if (process.env.AXON_PUBLIC_SITE_URL) {
  try {
    if (new URL(process.env.AXON_PUBLIC_SITE_URL).protocol !== "https:")
      throw Error();
  } catch {
    console.error("AXON_PUBLIC_SITE_URL must use HTTPS");
    failures++;
  }
}
if (process.env.AXON_DATABASE_URL) {
  try {
    const u = new URL(process.env.AXON_DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(u.protocol)) throw Error();
    if (u.searchParams.get("sslmode") !== "verify-full") {
      console.error(
        "Production database must explicitly use sslmode=verify-full (configure a trusted CA if necessary).",
      );
      failures++;
    }
  } catch {
    console.error("Invalid database URL");
    failures++;
  }
}
if (process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_"))
  console.log("INFO Razorpay is in test mode; required for staging.");
if (!fs.existsSync("backend/workflows/manifest.json")) {
  console.error(
    "MISSING generated workflow manifest; run npm run backend:generate -- <export folder>",
  );
  failures++;
}
console.log(
  "No secret values were printed. This check does not verify domain ownership, identity migration, provider settings, backups or live behavior.",
);
process.exitCode = failures ? 1 : 0;

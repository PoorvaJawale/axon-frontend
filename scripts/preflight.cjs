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
  "No secret values were printed. This check does not verify provider settings, backups or live behavior.",
);
process.exitCode = failures ? 1 : 0;

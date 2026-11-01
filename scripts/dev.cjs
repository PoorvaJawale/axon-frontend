/* eslint-disable @typescript-eslint/no-require-imports -- Node operator/development entrypoint. */
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
require("@next/env").loadEnvConfig(process.cwd(), true);
const env = { ...process.env };
// Preserve this project's existing local development setup across the Clerk upgrade.
// Production commands never use this fallback; no new identity app or keys are created.
if (
  env.NODE_ENV !== "production" &&
  !env.CLERK_SECRET_KEY &&
  !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
) {
  try {
    const cached = JSON.parse(
      fs.readFileSync(
        path.join(process.cwd(), ".clerk", ".tmp", "keyless.json"),
        "utf8",
      ),
    );
    if (
      cached.secretKey?.startsWith("sk_test_") &&
      cached.publishableKey?.startsWith("pk_test_")
    ) {
      env.CLERK_SECRET_KEY = cached.secretKey;
      env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = cached.publishableKey;
      console.log("Using the existing local Clerk development configuration.");
    }
  } catch {
    /* A configured .env.local can still be loaded by Next.js. */
  }
}
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    "dev",
    "--webpack",
    ...process.argv.slice(2),
  ],
  { env, stdio: "inherit" },
);
child.on("error", () => {
  console.error("Could not start Next.js.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
process.on("SIGTERM", () => child.kill("SIGTERM"));

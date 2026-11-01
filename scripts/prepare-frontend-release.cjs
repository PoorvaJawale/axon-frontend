/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
const destination = path.join(
  root,
  ".cache/production-deployment/frontend-" +
    crypto.randomBytes(6).toString("hex"),
);
const files = [];
const forbidden = [".env", ".cache", ".git", "node_modules"];
function copy(relative) {
  if (
    relative
      .split(/[\\/]/)
      .some((p) => forbidden.includes(p) || p.startsWith(".env."))
  )
    throw Error("Forbidden release path");
  const source = path.join(root, relative);
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw Error("Release symlinks are not allowed");
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(source))
      copy(path.join(relative, child));
    return;
  }
  const data = fs.readFileSync(source);
  if (
    /(?:sk_live_|sk_test_|rzp_live_)[A-Za-z0-9_-]{24,}/.test(
      data.toString("utf8"),
    )
  )
    throw Error(
      "Potential provider secret in release source; stop and inspect privately",
    );
  const target = path.join(destination, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  files.push({
    path: relative.replace(/\\/g, "/"),
    bytes: data.length,
    sha256: crypto.createHash("sha256").update(data).digest("hex"),
  });
}
for (const entry of [
  "app",
  "components",
  "lib",
  "public",
  "backend/n8n/policy.cjs",
  "scripts/dev.cjs",
  "scripts/provider-preflight.cjs",
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "next-env.d.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "proxy.ts",
])
  copy(entry);
const record = {
  at: new Date().toISOString(),
  directory: destination,
  files,
  sourceOnly: true,
  containsEnvironmentFiles: false,
};
fs.writeFileSync(
  path.join(root, ".cache/production-deployment/frontend-release.json"),
  JSON.stringify(record, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    directory: destination,
    fileCount: files.length,
    bytes: files.reduce((sum, x) => sum + x.bytes, 0),
    containsEnvironmentFiles: false,
  }),
);

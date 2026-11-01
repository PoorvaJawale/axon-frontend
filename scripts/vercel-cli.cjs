/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const directory = path.join(root, ".cache/tools/vercel/node_modules/vercel");
const manifest = path.join(directory, "package.json");
if (!fs.existsSync(manifest)) {
  console.error("The pinned D: Vercel CLI is not installed yet.");
  process.exitCode = 1;
} else {
  const packageInfo = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const bin =
    typeof packageInfo.bin === "string"
      ? packageInfo.bin
      : packageInfo.bin.vercel;
  const entry = path.resolve(directory, bin);
  if (!entry.startsWith(directory + path.sep))
    throw Error("Unexpected CLI entrypoint");
  const authDir = path.join(root, ".cache/vercel-auth");
  fs.mkdirSync(authDir, { recursive: true });
  // `vercel curl` forwards --global-config to native curl. Use the CLI's
  // supported XDG default path instead, retaining the existing D: login.
  const dataDir = path.join(root, ".cache/vercel-xdg");
  fs.mkdirSync(dataDir, { recursive: true });
  const authLink = path.join(dataDir, "com.vercel.cli");
  if (!fs.existsSync(authLink))
    fs.symlinkSync(
      authDir,
      authLink,
      process.platform === "win32" ? "junction" : "dir",
    );
  if (fs.realpathSync(authLink) !== fs.realpathSync(authDir))
    throw Error("Unexpected Vercel configuration destination");
  const env = {
    ...process.env,
    VERCEL_TELEMETRY_DISABLED: "1",
    TEMP: path.join(root, ".cache/tmp"),
    TMP: path.join(root, ".cache/tmp"),
    XDG_DATA_HOME: dataDir,
    XDG_CACHE_HOME: path.join(root, ".cache/vercel-cache"),
    XDG_CONFIG_HOME: path.join(root, ".cache/vercel-config"),
  };
  const child = spawn(process.execPath, [entry, ...process.argv.slice(2)], {
    cwd: root,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("error", () => {
    console.error("Could not start Vercel CLI.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code || 0;
  });
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

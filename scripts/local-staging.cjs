/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const local = path.join(root, ".cache", "staging");
const secretFile = path.join(local, ".env");
const composeFile = path.join(root, "backend", "staging", "compose.yaml");
function compose(args, capture = false) {
  const result = spawnSync(
    "docker",
    ["compose", "--env-file", secretFile, "-f", composeFile, ...args],
    {
      cwd: root,
      encoding: "utf8",
      stdio: capture ? "pipe" : "inherit",
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      "Docker Compose did not complete. Check Docker Desktop and the local staging configuration.",
    );
  return result.stdout;
}
function prepare() {
  fs.mkdirSync(local, { recursive: true });
  for (const dir of ["postgres", "n8n"])
    fs.mkdirSync(path.join(local, dir), { recursive: true });
  if (!fs.existsSync(secretFile)) {
    const make = () => crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(
      secretFile,
      `STAGING_DB_PASSWORD=${make()}\nSTAGING_WEB_PASSWORD=${make()}\nSTAGING_VALIDATOR_PASSWORD=${make()}\nSTAGING_N8N_KEY=${make()}\nSTAGING_RUNNER_TOKEN=${make()}\n`,
      { mode: 0o600, flag: "wx" },
    );
  }
  const values = Object.fromEntries(
    fs
      .readFileSync(secretFile, "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split("=")),
  );
  for (const value of Object.values(values))
    if (!/^[a-f0-9]{64}$/.test(value))
      throw new Error("Unexpected staging secret format; no SQL generated.");
  const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
  const sql = [
    "-- LOCAL STAGING ONLY. Initialized once by this project's isolated Postgres container.",
    read("tests/fixtures/inspected-schema.sql"),
    read("backend/inspection/current-functions.sql"),
    ...fs
      .readdirSync(path.join(root, "backend/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()
      .map((n) => read("backend/migrations/" + n)),
    read("backend/deployment/grants.sql"),
    `CREATE ROLE axon_staging_web LOGIN PASSWORD '${values.STAGING_WEB_PASSWORD}'; GRANT axon_web TO axon_staging_web;`,
    `CREATE ROLE axon_staging_validator LOGIN PASSWORD '${values.STAGING_VALIDATOR_PASSWORD}'; GRANT axon_validator TO axon_staging_validator;`,
  ].join("\n\n");
  fs.writeFileSync(path.join(local, "init.sql"), sql, { mode: 0o600 });
  compose(["config", "--quiet"], true);
  console.log(
    "Local staging prepared and Compose configuration validated. Secrets and data stay in ignored .cache/staging. No services started or production data copied.",
  );
}
try {
  const action = process.argv[2] || "prepare";
  if (action === "prepare") prepare();
  else if (["start", "stop", "status"].includes(action)) {
    if (!fs.existsSync(secretFile))
      throw new Error("Run node scripts/local-staging.cjs prepare first.");
    if (action === "start") {
      if (process.platform === "win32") {
        const disk = spawnSync(
          "powershell.exe",
          ["-NoProfile", "-Command", "[long](Get-PSDrive C).Free"],
          { encoding: "utf8" },
        );
        if (disk.status !== 0 || Number(disk.stdout.trim()) < 5 * 1024 ** 3)
          throw new Error(
            "Free at least 5 GB on C: before starting Docker. Keep Docker image storage on a drive with adequate additional space.",
          );
      }
      compose(["up", "-d"]);
      console.log(
        "Local n8n: http://localhost:5688. Containers started; readiness, workflow import and provider tests still need verification.",
      );
    } else compose(action === "stop" ? ["stop"] : ["ps"]);
  } else throw new Error("Use prepare, start, stop or status.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

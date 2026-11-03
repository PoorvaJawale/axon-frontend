/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs"),
  path = require("path"),
  { spawnSync } = require("child_process");
const { decide } = require("../backend/operations/health-alert.cjs");
const root = path.resolve(__dirname, ".."),
  directory = path.join(root, ".cache/production-deployment"),
  file = path.join(directory, "service-alert-state.json");
try {
  fs.mkdirSync(directory, { recursive: true });
  const previous = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : null;
  if (process.argv.includes("--notification-test")) {
    if (previous?.notificationProbeAttempted) {
      console.log(
        JSON.stringify({
          notify: false,
          test: true,
          message: "Notification probe was already attempted; no repeat.",
        }),
      );
    } else {
      fs.writeFileSync(
        file,
        JSON.stringify(
          {
            ...previous,
            notificationProbeAttempted: true,
            probeAttemptedAt: new Date().toISOString(),
          },
          null,
          2,
        ) + "\n",
        { mode: 0o600 },
      );
      console.log(
        JSON.stringify({
          notify: true,
          test: true,
          message:
            "Axon alert-channel test: no outage was created. Failure/recovery monitoring is configured; local checks require this computer and Codex to be available.",
        }),
      );
    }
  } else {
    const r = spawnSync(
      process.execPath,
      [path.join(root, "scripts/check-deployment.cjs")],
      {
        encoding: "utf8",
        timeout: 25000,
        windowsHide: true,
        env: {
          PATH: process.env.PATH,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
          AXON_MONITOR_WEB_URL:
            "https://axon-frontend-vxa8.vercel.app/api/health",
          AXON_MONITOR_STATUS_URL:
            "https://axon-frontend-vxa8.vercel.app/api/status",
        },
      },
    );
    const states = Object.fromEntries(
      (r.stdout || "")
        .trim()
        .split(/\r?\n/)
        .map((l) => l.split(": "))
        .filter((p) => ["web", "backend", "database"].includes(p[0])),
    );
    if (r.error || Object.keys(states).length !== 3)
      throw Error("Monitor execution failed");
    const d = decide(previous?.signature ? previous : null, states),
      at = new Date().toISOString();
    fs.writeFileSync(
      file,
      JSON.stringify({ ...previous, ...d, states, checkedAt: at }, null, 2) +
        "\n",
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        ...d,
        states,
        checkedAt: at,
        message: d.healthy
          ? "Axon monitored checks have recovered."
          : "Axon health check needs attention: " +
            Object.entries(states)
              .map(([n, s]) => n + " " + s)
              .join(", ") +
            ". Check failures do not establish a sustained outage.",
      }),
    );
  }
} catch {
  console.error(
    "Health alert operator failed; verify monitor access and local state. No private diagnostics printed.",
  );
  process.exitCode = 1;
}

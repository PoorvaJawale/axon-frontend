/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only gate. Never starts, restores, changes or connects a recovery container to a network.
const { execFileSync } = require("node:child_process");
const {
  operatorStore,
  readTombstones,
  assertRecoveryClean,
} = require("../backend/operations/privacy-ledger.cjs");
async function main() {
  const db = process.argv[2];
  if (
    !/^axon_restore18_[a-f0-9]{16}$/.test(db || "") ||
    !process.argv.includes("--legacy-deletions-reviewed")
  )
    throw Error(
      "Specify the offline application restore database and --legacy-deletions-reviewed only after reviewing deletions predating this ledger.",
    );
  const container = "axon-offline-recovery-postgres18";
  const call = (args, options = {}) => {
    try {
      return execFileSync("docker", args, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        ...options,
      });
    } catch {
      throw Error(
        "Offline recovery check unavailable; keep restored data offline. Raw database output suppressed.",
      );
    }
  };
  const state = JSON.parse(call(["inspect", container]))[0];
  if (
    !state.State.Running ||
    state.HostConfig.NetworkMode !== "none" ||
    Object.keys(state.NetworkSettings.Ports || {}).length ||
    Object.keys(state.HostConfig.PortBindings || {}).length
  )
    throw Error(
      "Recovery must already be running with network none and no ports. This command does not change it.",
    );
  const receipts = await readTombstones(operatorStore());
  const result = await assertRecoveryClean(receipts, async (ids) => {
    // Validated receipt IDs cannot escape this dollar-quoted JSON value. stdin avoids command-line identity disclosure.
    const tables = [
      "public.axon_account_quota",
      "public.api_keys",
      "public.validation_logs",
      "public.axon_quota_reservation",
      "axon_security.validation_jobs",
      "axon_security.validation_inflight",
      "axon_security.callback_destinations",
      "axon_security.alert_reviews",
      "axon_security.checkout_operations",
    ];
    const predicate =
      "user_id IN (SELECT jsonb_array_elements_text($deleted$" +
      JSON.stringify(ids) +
      "$deleted$::jsonb))";
    const sql =
      "BEGIN READ ONLY; SET LOCAL statement_timeout=10000; SELECT EXISTS(" +
      tables
        .map((t) => "SELECT 1 FROM " + t + " WHERE " + predicate)
        .join(" UNION ALL ") +
      "); ROLLBACK;";
    const output = call(
      [
        "exec",
        "-i",
        container,
        "psql",
        "-X",
        "-U",
        "postgres",
        "-d",
        db,
        "-v",
        "ON_ERROR_STOP=1",
        "-qAt",
      ],
      { input: sql },
    ).trim();
    if (!["t", "f"].includes(output))
      throw Error("Unexpected recovery-check result; keep recovery offline.");
    return output === "t";
  });
  console.log(
    JSON.stringify({
      readOnly: true,
      offlineOnly: true,
      ...result,
      legacyReview: "operator-attested",
      activationApproved: false,
    }),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

/* eslint-disable @typescript-eslint/no-require-imports -- Explicit operator-only workflow. */
// Dry-run by default. Never called by the website or scheduled automatically.
const { Pool } = require("pg");
const { createClerkClient } = require("@clerk/backend");
const flags = new Set(process.argv.slice(2));
const value = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
async function main() {
  const requestId = value("--request");
  if (!/^[a-f0-9-]{36}$/i.test(requestId || ""))
    throw Error(
      "Provide --request <recorded-deletion-request-uuid>. Dry-run is the default.",
    );
  const connection = process.env.AXON_MAINTENANCE_DATABASE_URL;
  if (
    !connection ||
    new URL(connection).searchParams.get("sslmode") !== "verify-full"
  )
    throw Error(
      "Configure the dedicated verified-TLS database URL explicitly.",
    );
  const pool = new Pool({
    connectionString: process.env.AXON_MAINTENANCE_DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
  const db = await pool.connect();
  try {
    const r = (
      await db.query(
        "SELECT * FROM axon_security.privacy_requests WHERE id=$1 AND kind='delete'",
        [requestId],
      )
    ).rows[0];
    if (!r) throw Error("No authenticated deletion request found.");
    if (r.state === "completed") {
      console.log("This deletion request is already completed.");
      return;
    }
    if (!["pending", "processing"].includes(r.state))
      throw Error("This request is not eligible for processing.");
    if (!flags.has("--apply")) {
      console.log(
        "Dry-run only: request exists. Apply requires the exact user ID, provider/backup retention review, a deployed control plane, and dedicated operator credentials. No records changed.",
      );
      return;
    }
    if (
      value("--confirm-user") !== r.user_id ||
      !flags.has("--provider-retention-reviewed") ||
      !flags.has("--backup-retention-reviewed") ||
      !flags.has("--control-deploy-verified")
    )
      throw Error(
        "Supply --confirm-user and all three review flags after the deployment/retention checks.",
      );
    if (!process.env.CLERK_SECRET_KEY)
      throw Error("Clerk operator configuration is required.");
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    let user;
    try {
      user = await clerk.users.getUser(r.user_id);
    } catch (e) {
      if (e.status !== 404)
        throw Error("Could not verify the identity provider.");
    }
    const quota = (
      await db.query(
        "SELECT plan,period_end FROM public.axon_account_quota WHERE user_id=$1",
        [r.user_id],
      )
    ).rows[0];
    if (
      quota &&
      quota.plan !== "free" &&
      new Date(quota.period_end).getTime() > Date.now()
    )
      throw Error(
        "The paid period has not ended. Verify cancellation and complete closure after the paid period.",
      );
    const checkout = (
      await db.query(
        "SELECT subscription_id,state FROM axon_security.checkout_operations WHERE user_id=$1",
        [r.user_id],
      )
    ).rows[0];
    if (checkout && ["pending", "ambiguous"].includes(checkout.state))
      throw Error(
        "Resolve the ambiguous checkout with Razorpay before account deletion.",
      );
    const ids = new Set(
      [
        checkout?.subscription_id,
        user?.privateMetadata?.razorpaySubscriptionId,
        user?.privateMetadata?.razorpayPendingSubscriptionId,
      ].filter((x) => typeof x === "string"),
    );
    for (const id of ids) {
      if (!/^sub_[a-zA-Z0-9]+$/.test(id))
        throw Error("Subscription reference needs manual review.");
      const key = process.env.RAZORPAY_KEY_ID,
        secret = process.env.RAZORPAY_KEY_SECRET;
      if (!key || !secret)
        throw Error("Payment-provider operator configuration is required.");
      const res = await fetch(
        "https://api.razorpay.com/v1/subscriptions/" + encodeURIComponent(id),
        {
          headers: {
            Authorization:
              "Basic " + Buffer.from(key + ":" + secret).toString("base64"),
          },
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        },
      );
      if (!res.ok) throw Error("Could not verify subscription closure.");
      const sub = await res.json();
      if (
        sub.notes?.clerk_user_id !== r.user_id ||
        !["cancelled", "completed", "expired"].includes(sub.status)
      )
        throw Error(
          "Cancel/close every linked subscription before deleting the identity.",
        );
    }
    // Stop ingress first, using the same provisioning/account lock order as key creation.
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "provision:" + r.user_id,
    ]);
    await db.query(
      "SELECT 1 FROM public.axon_account_quota WHERE user_id=$1 FOR UPDATE",
      [r.user_id],
    );
    await db.query(
      "UPDATE axon_security.privacy_requests SET state='processing',started_at=COALESCE(started_at,now()) WHERE id=$1",
      [requestId],
    );
    await db.query(
      "UPDATE public.api_keys SET is_active=false,updated_at=now() WHERE user_id=$1",
      [r.user_id],
    );
    await db.query("COMMIT");
    const started = (
      await db.query(
        "SELECT started_at FROM axon_security.privacy_requests WHERE id=$1",
        [requestId],
      )
    ).rows[0].started_at;
    if (Date.now() - new Date(started).getTime() < 180000) {
      console.log(
        "Keys revoked; account closure is processing. Rerun this reviewed command after three minutes to allow the 120-second workflow deadline to drain. No user data has been deleted yet.",
      );
      return;
    }
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "provision:" + r.user_id,
    ]);
    await db.query(
      "SELECT 1 FROM public.axon_account_quota WHERE user_id=$1 FOR UPDATE",
      [r.user_id],
    );
    const active = (
      await db.query(
        "SELECT 1 FROM axon_security.validation_inflight WHERE user_id=$1 AND expires_at>now() UNION ALL SELECT 1 FROM axon_security.validation_jobs WHERE user_id=$1 AND state='processing' AND lease_until>now() LIMIT 1",
        [r.user_id],
      )
    ).rows;
    if (active.length)
      throw Error("Validation work is still draining; retry later.");
    for (const table of [
      "axon_security.validation_jobs",
      "axon_security.validation_inflight",
      "axon_security.alert_reviews",
      "axon_security.callback_destinations",
      "public.validation_logs",
      "public.axon_quota_reservation",
      "public.api_keys",
      "public.axon_account_quota",
      "axon_security.checkout_operations",
    ])
      await db.query("DELETE FROM " + table + " WHERE user_id=$1", [r.user_id]);
    await db.query("COMMIT");
    // Cross-provider completion is retryable: the processing marker blocks reprovisioning.
    try {
      await clerk.users.deleteUser(r.user_id);
    } catch (e) {
      if (e.status !== 404)
        throw Error(
          "Application data was removed but identity deletion needs retry. Leave the request processing and rerun.",
        );
    }
    await db.query(
      "DELETE FROM axon_security.privacy_requests WHERE user_id=$1 AND id<>$2",
      [r.user_id, requestId],
    );
    await db.query(
      "UPDATE axon_security.privacy_requests SET state='completed',completed_at=now() WHERE id=$1",
      [requestId],
    );
    console.log(
      "Application records and Clerk identity deleted. A minimal deletion receipt remains for 100 days. Provider/support/backup retention must match the reviews performed before this command.",
    );
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
    await pool.end();
  }
}
main().catch((e) => {
  console.error(
    e.code ? "Deletion requires operator review (" + e.code + ")." : e.message,
  );
  process.exitCode = 1;
});

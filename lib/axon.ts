import { clerkClient } from "@clerk/nextjs/server";
import { query } from "@/lib/db";
/** Only verified provider handlers call this. PostgreSQL remains the entitlement source. */
export async function setUserPlan(
  userId: string,
  plan: "free" | "pro" | "enterprise",
  requestLimit: number,
  billing: { period_start?: number; period_end?: number; occurred_at: number },
) {
  const iso = (value: number | undefined) =>
    value === undefined ? null : new Date(value * 1000).toISOString();
  const rows = await query(
    "SELECT public.axon_apply_billing($1,$2,$3::timestamptz,$4::timestamptz,$5::timestamptz,$6::bigint) AS data",
    [
      userId,
      plan,
      iso(billing.period_start),
      iso(billing.period_end),
      iso(billing.occurred_at),
      plan === "enterprise" ? requestLimit : 0,
    ],
  );
  const result = rows[0]?.data;
  if (result?.success !== true)
    throw new Error("Billing transaction was not acknowledged");
  if (result.ignored === true) return { ignored: true };
  const client = await clerkClient();
  // Metadata is a convenience copy. Its failure must not roll back a saved entitlement.
  await client.users
    .updateUserMetadata(userId, { privateMetadata: { axonPlan: plan } })
    .catch(() => console.error("Plan metadata needs reconciliation"));
  return { ignored: false };
}

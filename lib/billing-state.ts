import "server-only";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/security/http";
export async function savedCheckout(userId: string) {
  return (
    await query(
      "SELECT * FROM axon_security.checkout_operations WHERE user_id=$1",
      [userId],
    )
  )[0];
}
export async function beginCheckout(userId: string, planId: string) {
  const rows = await query(
    "INSERT INTO axon_security.checkout_operations(user_id,state,plan_id) VALUES($1,'pending',$2) ON CONFLICT(user_id) DO NOTHING RETURNING operation_id",
    [userId, planId],
  );
  if (!rows.length)
    throw new HttpError(
      409,
      "CHECKOUT_PENDING",
      "An earlier checkout is still being checked. Restore its subscription or contact support before paying again.",
    );
  return String(rows[0].operation_id);
}
export async function finishCheckout(
  userId: string,
  operationId: string,
  subscriptionId: string,
) {
  await query(
    "UPDATE axon_security.checkout_operations SET state='ready',subscription_id=$3,updated_at=now() WHERE user_id=$1 AND operation_id=$2",
    [userId, operationId, subscriptionId],
  );
}
export async function ambiguousCheckout(userId: string, operationId: string) {
  await query(
    "UPDATE axon_security.checkout_operations SET state='ambiguous',updated_at=now() WHERE user_id=$1 AND operation_id=$2 AND state='pending'",
    [userId, operationId],
  );
}
export async function clearTerminalCheckout(userId: string, id: string) {
  await query(
    "DELETE FROM axon_security.checkout_operations WHERE user_id=$1 AND subscription_id=$2 AND state='ready'",
    [userId, id],
  );
}
export async function claimEvent(id: string, hash: string) {
  const rows = await query(
    "INSERT INTO axon_security.webhook_events(event_id,body_hash,state,lease_until) VALUES($1,$2,'processing',now()+interval '2 minutes') ON CONFLICT(event_id) DO UPDATE SET lease_until=EXCLUDED.lease_until WHERE axon_security.webhook_events.body_hash=EXCLUDED.body_hash AND axon_security.webhook_events.state='processing' AND axon_security.webhook_events.lease_until<now() RETURNING event_id",
    [id, hash],
  );
  if (rows.length) return true;
  const existing = (
    await query(
      "SELECT body_hash,state FROM axon_security.webhook_events WHERE event_id=$1",
      [id],
    )
  )[0];
  if (existing?.body_hash !== hash)
    throw new HttpError(409, "EVENT_MISMATCH", "Event identity mismatch.");
  if (existing?.state === "completed") return false;
  throw new HttpError(
    503,
    "EVENT_PROCESSING",
    "Event is already processing; retry later.",
  );
}
export async function completeEvent(id: string) {
  await query(
    "UPDATE axon_security.webhook_events SET state='completed',completed_at=now() WHERE event_id=$1",
    [id],
  );
}
export async function retryEvent(id: string) {
  await query(
    "UPDATE axon_security.webhook_events SET lease_until=now() WHERE event_id=$1 AND state='processing'",
    [id],
  );
}

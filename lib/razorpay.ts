import { setUserPlan } from "@/lib/axon";
import { PRO_VALIDATION_LIMIT } from "@/lib/plans";

export type RazorpaySubscription = {
  id: string; plan_id: string; status: string; paid_count: number;
  current_start: number | null; current_end: number | null;
  notes?: Record<string, string>;
};
export class BillingSyncError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export async function fetchSubscription(id: string): Promise<RazorpaySubscription> {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw new BillingSyncError("PAYMENTS_CONFIGURATION", "Payments are not configured");
  if (!/^sub_[a-zA-Z0-9]+$/.test(id)) throw new BillingSyncError("INVALID_SUBSCRIPTION", "Invalid subscription ID");
  const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: "Basic " + Buffer.from(`${key}:${secret}`).toString("base64") },
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new BillingSyncError("PROVIDER_UNAVAILABLE", "Could not confirm the subscription with Razorpay");
  const subscription = await response.json();
  if (subscription.id !== id) throw new BillingSyncError("INVALID_SUBSCRIPTION", "Subscription ID mismatch");
  return subscription;
}
export function requireOwnedSubscription(subscription: RazorpaySubscription, userId: string) {
  if (subscription.notes?.clerk_user_id !== userId) {
    throw new BillingSyncError("SUBSCRIPTION_OWNERSHIP", "This subscription does not belong to the signed-in account");
  }
}
export async function activateSubscription(subscription: RazorpaySubscription, userId: string, occurredAt: number) {
  requireOwnedSubscription(subscription, userId);
  if (subscription.plan_id !== process.env.RAZORPAY_PLAN_ID) {
    throw new BillingSyncError("LEGACY_PLAN", "This subscription needs a separate plan migration. Contact support; do not pay again.");
  }
  if (subscription.status !== "active" || !(subscription.paid_count > 0) ||
      !Number.isSafeInteger(subscription.current_start) || !Number.isSafeInteger(subscription.current_end) ||
      !subscription.current_start || !subscription.current_end || subscription.current_end <= Math.floor(Date.now()/1000) ||
      subscription.current_end <= subscription.current_start || subscription.current_start > Math.floor(Date.now()/1000)) {
    throw new BillingSyncError("ACTIVATION_PENDING", "Razorpay has not confirmed an active paid billing period yet");
  }
  return setUserPlan(userId, "pro", PRO_VALIDATION_LIMIT, {
    period_start: subscription.current_start,
    period_end: subscription.current_end,
    occurred_at: occurredAt,
  });
}

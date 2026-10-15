import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { setUserPlan } from "@/lib/axon";
import { FREE_VALIDATION_LIMIT } from "@/lib/plans";
import { activateSubscription, BillingSyncError, fetchSubscription, requireOwnedSubscription } from "@/lib/razorpay";

const UPGRADE_EVENTS = [
  "subscription.activated",
  "subscription.charged",
  "subscription.resumed",
];
const DOWNGRADE_EVENTS = [
  "subscription.cancelled",
  "subscription.halted",
  "subscription.expired",
  "subscription.completed",
];

/**
 * Razorpay server-to-server webhook. Signature-verified with the webhook
 * secret; this is the authoritative path for renewals and cancellations.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  let valid = false;
  try {
    valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event?: string;
    created_at?: number;
    payload?: { subscription?: { entity?: { id?: string; notes?: Record<string, string> } } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const type = event.event ?? "";
  const clerkUserId = event.payload?.subscription?.entity?.notes?.clerk_user_id;

  if (!clerkUserId) {
    // Not a subscription event we track — acknowledge so Razorpay stops retrying.
    return NextResponse.json({ received: true });
  }

  try {
    if (UPGRADE_EVENTS.includes(type) || DOWNGRADE_EVENTS.includes(type)) {
      const id = event.payload?.subscription?.entity?.id;
      if (!id) return NextResponse.json({ error: "Missing subscription ID" }, { status: 400 });
      const subscription = await fetchSubscription(id);
      requireOwnedSubscription(subscription, clerkUserId);
      // Resolve delayed cancellation/charge events against current provider state.
      if (subscription.status === "active") {
        const result = await activateSubscription(subscription, clerkUserId, Math.floor(Date.now()/1000));
        if (!result.ignored) {
          const client = await clerkClient();
          await client.users.updateUserMetadata(clerkUserId, { privateMetadata: { razorpaySubscriptionId: id } });
        }
      } else if (DOWNGRADE_EVENTS.includes(type) && ["cancelled", "halted", "expired", "completed"].includes(subscription.status)) {
        // Do not downgrade a newer/different subscription owned by this user.
        const client = await clerkClient();
        const user = await client.users.getUser(clerkUserId);
        if (user.privateMetadata.razorpaySubscriptionId === id) {
          await setUserPlan(clerkUserId, "free", FREE_VALIDATION_LIMIT, { occurred_at: Math.floor(Date.now()/1000) });
        }
      } else if (UPGRADE_EVENTS.includes(type)) {
        throw new Error("Paid subscription is not active yet");
      }
    }
  } catch (err) {
    if (err instanceof BillingSyncError && err.code === "LEGACY_PLAN") {
      console.error("Legacy paid subscription requires migration");
      return NextResponse.json({ received: true, migrationRequired: true });
    }
    console.error(`Razorpay webhook ${type} handling failed:`, err);
    // 500 makes Razorpay retry later, which is what we want if our DB was down.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

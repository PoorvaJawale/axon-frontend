import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { setUserPlan } from "@/lib/axon";

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
    payload?: { subscription?: { entity?: { notes?: Record<string, string> } } };
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
    if (UPGRADE_EVENTS.includes(type)) {
      await setUserPlan(clerkUserId, "pro", 50000);
    } else if (DOWNGRADE_EVENTS.includes(type)) {
      await setUserPlan(clerkUserId, "free", 1000);
    }
  } catch (err) {
    console.error(`Razorpay webhook ${type} handling failed:`, err);
    // 500 makes Razorpay retry later, which is what we want if our DB was down.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

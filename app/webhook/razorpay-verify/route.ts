import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import crypto from "crypto";
import { setUserPlan } from "@/lib/axon";

/**
 * Called by the browser right after Razorpay Checkout succeeds. Verifies the
 * checkout signature and upgrades the user immediately (the webhook remains
 * the authoritative source for renewals/cancellations).
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 500 });
  }

  let body: {
    razorpay_payment_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = body;
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_payment_id}|${razorpay_subscription_id}`)
    .digest("hex");

  let valid = false;
  try {
    valid = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(razorpay_signature)
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
  }

  try {
    await setUserPlan(userId, "pro", 50000);
    // Remember the subscription so we can show real invoice history later.
    const client = await clerkClient();
    await client.users.updateUserMetadata(userId, {
      privateMetadata: { razorpaySubscriptionId: razorpay_subscription_id },
    });
  } catch (err) {
    console.error("Plan upgrade after payment failed:", err);
    return NextResponse.json(
      { error: "Payment verified but upgrade failed — contact support" },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, plan: "pro" });
}

import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import crypto from "crypto";
import { activateSubscription, BillingSyncError, fetchSubscription, requireOwnedSubscription } from "@/lib/razorpay";

/** Verify an owned subscription and retry provisioning without initiating payment. */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to restore your subscription", code: "UNAUTHORIZED" }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid payload" }, { status: 400 }); }
  const client = await clerkClient();
  try {
    const user = await client.users.getUser(userId);
    const callback = typeof body.razorpay_subscription_id === "string";
    const id = callback ? body.razorpay_subscription_id : body.subscriptionId ||
      user.privateMetadata.razorpayPendingSubscriptionId || user.privateMetadata.razorpaySubscriptionId;
    if (typeof id !== "string" || !id) return NextResponse.json({ code: "SUBSCRIPTION_REQUIRED", error: "Enter the subscription ID from Razorpay to restore the existing payment." }, { status: 400 });
    const subscription = await fetchSubscription(id);
    requireOwnedSubscription(subscription, userId);
    if (callback) {
      const payment = body.razorpay_payment_id;
      const signature = body.razorpay_signature;
      if (typeof payment !== "string" || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) {
        return NextResponse.json({ error: "Invalid checkout signature", code: "SIGNATURE_INVALID" }, { status: 400 });
      }
      // Use the subscription ID returned by the authenticated provider API.
      const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${payment}|${subscription.id}`).digest("hex");
      if (!crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))) {
        return NextResponse.json({ error: "Checkout signature mismatch", code: "SIGNATURE_INVALID" }, { status: 400 });
      }
    }
    await client.users.updateUserMetadata(userId, { privateMetadata: { razorpayPendingSubscriptionId: subscription.id } });
    const result = await activateSubscription(subscription, userId, Math.floor(Date.now()/1000));
    if (result.ignored) return NextResponse.json({ code: "ACTIVATION_PENDING", error: "Billing is reconciling a newer update. Check activation again shortly." }, { status: 202 });
    await client.users.updateUserMetadata(userId, { privateMetadata: { razorpaySubscriptionId: subscription.id, razorpayPendingSubscriptionId: null } });
    return NextResponse.json({ success: true, plan: "pro" });
  } catch (error) {
    const code = error instanceof BillingSyncError ? error.code : "BILLING_SYNC_PENDING";
    console.error("Subscription activation failed:", code, error instanceof Error ? error.message : "Unknown error");
    const status = code === "SUBSCRIPTION_OWNERSHIP" ? 403 : code === "INVALID_SUBSCRIPTION" ? 400 : 503;
    return NextResponse.json({ code, error: code === "BILLING_SYNC_PENDING"
      ? "Subscription activation could not be saved. Retry activation without making another payment."
      : error instanceof Error ? error.message : "Activation is pending" }, { status });
  }
}

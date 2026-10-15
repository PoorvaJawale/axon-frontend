import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { BillingSyncError, fetchSubscription, requireOwnedSubscription } from "@/lib/razorpay";

/** Stop renewal only after an explicit confirmation; preserve the paid period. */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to cancel your subscription" }, { status: 401 });
  let body: { subscriptionId?: unknown; confirmed?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (body.confirmed !== true || typeof body.subscriptionId !== "string") {
    return NextResponse.json({ error: "Confirm which subscription you want to cancel" }, { status: 400 });
  }
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const subscription = await fetchSubscription(body.subscriptionId);
    requireOwnedSubscription(subscription, userId);
    const saved = user.privateMetadata.razorpayCancellation as { subscriptionId?: string; effectiveAt?: number } | undefined;
    if (["cancelled", "completed", "expired"].includes(subscription.status)) {
      return NextResponse.json({ success: true, alreadyCancelled: true, effectiveAt: subscription.current_end });
    }
    if (saved?.subscriptionId === subscription.id && saved.effectiveAt === subscription.current_end) {
      return NextResponse.json({ success: true, cancellationScheduled: true, effectiveAt: saved.effectiveAt });
    }
    if (subscription.status !== "active" || !subscription.current_end || subscription.current_end <= Math.floor(Date.now()/1000)) {
      return NextResponse.json({ error: "This subscription cannot be scheduled for cancellation in its current state. Refresh its status." }, { status: 409 });
    }
    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscription.id)}/cancel`, {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(`${key}:${secret}`).toString("base64"), "Content-Type": "application/json" },
      body: JSON.stringify({ cancel_at_cycle_end: true }),
      cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Razorpay did not confirm cancellation");
    const cancelled = await response.json();
    if (cancelled.id !== subscription.id || !["active", "cancelled"].includes(cancelled.status)) throw new Error("Unexpected cancellation response");
    await client.users.updateUserMetadata(userId, { privateMetadata: {
      razorpayCancellation: { subscriptionId: subscription.id, effectiveAt: subscription.current_end, requestedAt: Math.floor(Date.now()/1000) },
    } });
    return NextResponse.json({ success: true, cancellationScheduled: true, effectiveAt: subscription.current_end });
  } catch (error) {
    const code = error instanceof BillingSyncError ? error.code : "CANCELLATION_UNCONFIRMED";
    console.error("Cancellation confirmation failed:", code);
    return NextResponse.json({ code, error: code === "SUBSCRIPTION_OWNERSHIP" ? "This subscription does not belong to your account." : "Could not confirm cancellation. Refresh the subscription status before trying again." }, { status: code === "SUBSCRIPTION_OWNERSHIP" ? 403 : 503 });
  }
}

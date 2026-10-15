import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { PRO_MONTHLY_PRICE_INR } from "@/lib/plans";
import { fetchSubscription, requireOwnedSubscription } from "@/lib/razorpay";

/**
 * Creates a Razorpay subscription for the signed-in user and returns the ids
 * the browser needs to open Razorpay Checkout. The Clerk user id travels in
 * the subscription notes so webhooks can map payments back to the user.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const planId = process.env.RAZORPAY_PLAN_ID;
  if (!keyId || !keySecret || !planId) {
    return NextResponse.json(
      { error: "Payments are not configured yet" },
      { status: 500 }
    );
  }

  // Refuse an old Razorpay plan rather than charge a different advertised price.
  const authorization = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  try {
    const planResponse = await fetch(`https://api.razorpay.com/v1/plans/${encodeURIComponent(planId)}`, {
      headers: { Authorization: authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!planResponse.ok) {
      return NextResponse.json({ error: "Could not verify subscription pricing" }, { status: 502 });
    }
    const plan = await planResponse.json();
    if (plan.period !== "monthly" || plan.interval !== 1 ||
        plan.item?.currency !== "INR" || plan.item?.amount !== PRO_MONTHLY_PRICE_INR * 100) {
      return NextResponse.json(
        { error: "Pro checkout is being updated. Please try again later.", code: "PLAN_MISMATCH" },
        { status: 503 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Could not verify subscription pricing" }, { status: 502 });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const existingId = user.privateMetadata.razorpayPendingSubscriptionId || user.privateMetadata.razorpaySubscriptionId;
  if (typeof existingId === "string") {
    try {
      const existing = await fetchSubscription(existingId);
      requireOwnedSubscription(existing, userId);
      if (existing.status === "active" || (existing.paid_count > 0 &&
          (!(["cancelled", "completed", "expired"].includes(existing.status)) || (existing.current_end || 0) > Math.floor(Date.now()/1000)))) {
        return NextResponse.json({ code: "SUBSCRIPTION_EXISTS", error: "An existing payment needs activation. Restore your subscription without paying again." }, { status: 409 });
      }
      if (existing.plan_id === planId && ["created", "authenticated"].includes(existing.status)) {
        return NextResponse.json({ subscriptionId: existing.id, keyId });
      }
    } catch {
      return NextResponse.json({ code: "SUBSCRIPTION_EXISTS", error: "An existing subscription could not be checked. Restore it before starting another payment." }, { status: 503 });
    }
  }

  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: 60, // bill monthly for up to 5 years unless cancelled
      customer_notify: 1,
      notes: { clerk_user_id: userId, email },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("Razorpay subscription create failed:", await res.text());
    return NextResponse.json(
      { error: "Could not create subscription" },
      { status: 502 }
    );
  }

  const subscription = await res.json();
  await client.users.updateUserMetadata(userId, { privateMetadata: { razorpayPendingSubscriptionId: subscription.id } });
  return NextResponse.json({ subscriptionId: subscription.id, keyId });
}

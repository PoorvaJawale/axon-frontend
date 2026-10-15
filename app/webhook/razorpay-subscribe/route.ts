import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { PRO_MONTHLY_PRICE_INR } from "@/lib/plans";

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
  return NextResponse.json({ subscriptionId: subscription.id, keyId });
}

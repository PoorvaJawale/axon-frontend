import { accountUsage } from "@/lib/account-data";
import {
  savedCheckout,
  beginCheckout,
  finishCheckout,
  ambiguousCheckout,
  clearTerminalCheckout,
} from "@/lib/billing-state";
import { assertSameOrigin, failure, HttpError } from "@/lib/security/http";
import { limitRequest } from "@/lib/security/rate-limit";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { PRO_MONTHLY_PRICE_INR } from "@/lib/plans";
import { fetchSubscription, requireOwnedSubscription } from "@/lib/razorpay";

/**
 * Creates a Razorpay subscription for the signed-in user and returns the ids
 * the browser needs to open Razorpay Checkout. The Clerk user id travels in
 * the subscription notes so webhooks can map payments back to the user.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return await subscribe();
  } catch (error) {
    return failure(error);
  }
}
async function subscribe() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await limitRequest("checkout", userId, 5);
  const usage = await accountUsage(userId);
  if (usage.plan !== "free" && usage.period_active)
    throw new HttpError(
      409,
      "SUBSCRIPTION_EXISTS",
      "Your paid plan is already active. Manage the existing subscription before starting another checkout.",
    );
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const planId = process.env.RAZORPAY_PLAN_ID;
  if (!keyId || !keySecret || !planId) {
    throw new HttpError(
      503,
      "PAYMENTS_UNAVAILABLE",
      "Checkout is temporarily unavailable. No payment has been taken. Please try again later.",
    );
  }

  // Refuse an old Razorpay plan rather than charge a different advertised price.
  const authorization =
    "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  try {
    const planResponse = await fetch(
      `https://api.razorpay.com/v1/plans/${encodeURIComponent(planId)}`,
      {
        headers: { Authorization: authorization },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!planResponse.ok) {
      return NextResponse.json(
        { error: "Could not verify subscription pricing" },
        { status: 502 },
      );
    }
    const plan = await planResponse.json();
    if (
      plan.period !== "monthly" ||
      plan.interval !== 1 ||
      plan.item?.currency !== "INR" ||
      plan.item?.amount !== PRO_MONTHLY_PRICE_INR * 100
    ) {
      return NextResponse.json(
        {
          error: "Pro checkout is being updated. Please try again later.",
          code: "PLAN_MISMATCH",
        },
        { status: 503 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Could not verify subscription pricing" },
      { status: 502 },
    );
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const durable = await savedCheckout(userId);
  const existingId =
    durable?.subscription_id ||
    user.privateMetadata.razorpayPendingSubscriptionId ||
    user.privateMetadata.razorpaySubscriptionId;
  if (typeof existingId === "string") {
    try {
      const existing = await fetchSubscription(existingId);
      requireOwnedSubscription(existing, userId);
      if (
        existing.status === "active" ||
        (existing.paid_count > 0 &&
          (!["cancelled", "completed", "expired"].includes(existing.status) ||
            (existing.current_end || 0) > Math.floor(Date.now() / 1000)))
      ) {
        return NextResponse.json(
          {
            code: "SUBSCRIPTION_EXISTS",
            error:
              "An existing payment needs activation. Restore your subscription without paying again.",
          },
          { status: 409 },
        );
      }
      if (
        existing.plan_id === planId &&
        ["created", "authenticated"].includes(existing.status)
      ) {
        return NextResponse.json({ subscriptionId: existing.id, keyId });
      }
      if (["cancelled", "completed", "expired"].includes(existing.status))
        await clearTerminalCheckout(userId, existing.id);
    } catch {
      return NextResponse.json(
        {
          code: "SUBSCRIPTION_EXISTS",
          error:
            "An existing subscription could not be checked. Restore it before starting another payment.",
        },
        { status: 503 },
      );
    }
  }

  const operationId = await beginCheckout(userId, planId);
  try {
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
        notes: { clerk_user_id: userId, email, axon_operation_id: operationId },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.error("Razorpay subscription create failed", res.status);
      await ambiguousCheckout(userId, operationId);
      return NextResponse.json(
        { error: "Could not create subscription" },
        { status: 502 },
      );
    }

    const subscription = await res.json();
    if (
      typeof subscription.id !== "string" ||
      !/^sub_[a-zA-Z0-9]+$/.test(subscription.id)
    )
      throw new Error("Invalid provider response");
    await finishCheckout(userId, operationId, subscription.id);
    await client.users
      .updateUserMetadata(userId, {
        privateMetadata: { razorpayPendingSubscriptionId: subscription.id },
      })
      .catch(() => console.error("Checkout metadata needs reconciliation"));
    return NextResponse.json({ subscriptionId: subscription.id, keyId });
  } catch (error) {
    await ambiguousCheckout(userId, operationId);
    throw error;
  }
}

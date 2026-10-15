import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { BillingSyncError, fetchSubscription, requireOwnedSubscription } from "@/lib/razorpay";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to manage your subscription" }, { status: 401 });
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const id = new URL(req.url).searchParams.get("subscriptionId") || user.privateMetadata.razorpaySubscriptionId || user.privateMetadata.razorpayPendingSubscriptionId;
    if (typeof id !== "string" || !id) return NextResponse.json({ subscription: null });
    const subscription = await fetchSubscription(id);
    requireOwnedSubscription(subscription, userId);
    const saved = user.privateMetadata.razorpayCancellation as { subscriptionId?: string; effectiveAt?: number } | undefined;
    const scheduled = saved?.subscriptionId === id && saved.effectiveAt === subscription.current_end && subscription.status === "active";
    return NextResponse.json({ subscription: {
      id: subscription.id, status: subscription.status, currentEnd: subscription.current_end,
      cancellationScheduled: scheduled,
      canCancel: subscription.status === "active" && !!subscription.current_end && subscription.current_end > Math.floor(Date.now()/1000) && !scheduled,
    } });
  } catch (error) {
    const code = error instanceof BillingSyncError ? error.code : "STATUS_UNAVAILABLE";
    return NextResponse.json({ error: "Could not load this subscription. Check the ID and try again.", code }, { status: code === "SUBSCRIPTION_OWNERSHIP" ? 403 : 503 });
  }
}

import { limitRequest } from "@/lib/security/rate-limit";
import { failure, HttpError } from "@/lib/security/http";
import { savedCheckout } from "@/lib/billing-state";
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export type Invoice = {
  id: string;
  date: string;
  amount: string;
  status: string;
  url: string | null;
};

function fmtDate(unix: number | null | undefined): string {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtAmount(paise: number | null | undefined): string {
  if (paise == null) return "—";
  return "₹" + (paise / 100).toLocaleString("en-IN");
}

/**
 * Real payment history for the signed-in user, pulled from Razorpay's invoices
 * for their stored subscription. Returns an empty list (not an error) when the
 * user has no subscription or no invoices yet.
 */
export async function GET() {
  try {
    return await history();
  } catch (error) {
    return failure(error);
  }
}
async function history() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await limitRequest("billing-history", userId, 20);
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const durable = await savedCheckout(userId);
  const subscriptionId =
    user.privateMetadata?.razorpaySubscriptionId || durable?.subscription_id;

  // No subscription yet → no payments yet (normal for Free-tier users).
  if (!subscriptionId) {
    return NextResponse.json({ invoices: [] });
  }
  if (typeof subscriptionId !== "string")
    throw new HttpError(
      503,
      "HISTORY_UNAVAILABLE",
      "Payment history is temporarily unavailable. Please try again later.",
    );

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret)
    throw new HttpError(
      503,
      "PAYMENTS_UNAVAILABLE",
      "Payment history is temporarily unavailable. Please try again later.",
    );

  const authHeader =
    "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  let data: { items?: Record<string, unknown>[] };
  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/invoices?subscription_id=${encodeURIComponent(
        subscriptionId,
      )}&count=24`,
      {
        headers: { Authorization: authHeader },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) {
      console.error("Razorpay invoices fetch failed:", res.status);
      throw new Error("INVOICES_UNAVAILABLE");
    }
    data = await res.json();
  } catch (err) {
    console.error("Razorpay invoices fetch failed");
    throw err;
  }

  const invoices: Invoice[] = (data.items ?? []).map((it) => {
    const status = String(it.status ?? "").toLowerCase();
    return {
      id: String(it.id ?? ""),
      date: fmtDate(
        (it.paid_at as number) ??
          (it.issued_at as number) ??
          (it.date as number),
      ),
      amount: fmtAmount(it.amount as number),
      status: status === "paid" ? "PAID" : status.toUpperCase(),
      url:
        typeof it.short_url === "string" &&
        /^https:\/\/(?:rzp.io|[a-z0-9.-]+\.razorpay.com)\//i.test(it.short_url)
          ? it.short_url
          : null,
    };
  });

  return NextResponse.json({ invoices });
}

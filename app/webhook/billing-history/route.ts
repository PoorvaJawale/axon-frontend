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
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json({ invoices: [] });
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const subscriptionId = user.privateMetadata?.razorpaySubscriptionId as
    | string
    | undefined;

  // No subscription yet → no payments yet (normal for Free-tier users).
  if (!subscriptionId) {
    return NextResponse.json({ invoices: [] });
  }

  const authHeader =
    "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  let data: { items?: Record<string, unknown>[] };
  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/invoices?subscription_id=${encodeURIComponent(
        subscriptionId
      )}&count=24`,
      { headers: { Authorization: authHeader }, cache: "no-store" }
    );
    if (!res.ok) {
      console.error("Razorpay invoices fetch failed:", res.status);
      return NextResponse.json({ invoices: [] });
    }
    data = await res.json();
  } catch (err) {
    console.error("Razorpay invoices fetch error:", err);
    return NextResponse.json({ invoices: [] });
  }

  const invoices: Invoice[] = (data.items ?? []).map((it) => {
    const status = String(it.status ?? "").toLowerCase();
    return {
      id: String(it.id ?? ""),
      date: fmtDate((it.paid_at as number) ?? (it.issued_at as number) ?? (it.date as number)),
      amount: fmtAmount(it.amount as number),
      status: status === "paid" ? "PAID" : status.toUpperCase(),
      url: (it.short_url as string) ?? null,
    };
  });

  return NextResponse.json({ invoices });
}

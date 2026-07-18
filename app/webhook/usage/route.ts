import { NextResponse } from "next/server";
import { axonGet, getAxonContext } from "@/lib/axon";

export async function GET() {
  const ctx = await getAxonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ok, data } = await axonGet("/webhook/usage", ctx.apiKey);
  if (!ok || !data) {
    return NextResponse.json({ error: "Usage unavailable" }, { status: 502 });
  }

  const usage = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    monthly_requests: usage?.monthly_requests ?? 0,
    request_limit: usage?.request_limit ?? 0,
    remaining: usage?.remaining ?? 0,
    plan: usage?.plan ?? "free",
    expires_at: usage?.expires_at ?? null,
  });
}

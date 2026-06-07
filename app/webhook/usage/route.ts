import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const plan = searchParams.get("plan") || "Free";

  let limit = 50000;
  if (plan === "Pro") {
    limit = 500000;
  } else if (plan === "Enterprise") {
    limit = 10000000; // Representing unlimited/custom high limit
  }

  const usage = {
    monthly_requests: 12847,
    request_limit: limit,
    plan: plan,
  };

  return NextResponse.json(usage);
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { AXON_API_URL } from "@/lib/axon";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.AXON_SIGNUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let keyId: number;
  try {
    const body = await req.json();
    keyId = Number(body?.keyId);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!Number.isFinite(keyId) || keyId <= 0) {
    return NextResponse.json({ error: "Invalid key id" }, { status: 400 });
  }

  // user_id comes from the verified session, so users can only revoke their own keys
  const res = await fetch(`${AXON_API_URL}/webhook/revoke-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-axon-signup-secret": secret,
    },
    body: JSON.stringify({ user_id: userId, key_id: keyId }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Revoke failed" }, { status: 502 });
  }

  const data = await res.json();
  if (!data?.success) {
    return NextResponse.json(
      { error: "Key not found or not yours" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}

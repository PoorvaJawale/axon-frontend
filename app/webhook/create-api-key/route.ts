import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { AXON_API_URL } from "@/lib/axon";

/**
 * Provisions (or regenerates, with { force: true }) a real Axon API key for the
 * signed-in Clerk user. The signup secret and the full key live server-side only:
 * the key is stored in Clerk privateMetadata and returned to the browser exactly
 * once, at creation time, so the user can copy it.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.AXON_SIGNUP_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server misconfigured: AXON_SIGNUP_SECRET missing" },
      { status: 500 }
    );
  }

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const meta = (user.privateMetadata ?? {}) as Record<string, unknown>;

  let force = false;
  let keyName: string | undefined;
  try {
    const body = await req.json();
    force = body?.force === true;
    if (typeof body?.name === "string" && body.name.trim()) {
      keyName = body.name.trim().slice(0, 60);
    }
  } catch {
    // no body — plain provisioning call
  }

  // Auto-provision call with an existing key: nothing to do.
  // Explicitly named creations and forced regenerations always mint a new key.
  if (meta.axonApiKey && !force && !keyName) {
    return NextResponse.json({
      alreadyProvisioned: true,
      keyPrefix: meta.axonKeyPrefix ?? null,
      plan: (meta.axonPlan as string) ?? "free",
    });
  }

  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || email;

  const res = await fetch(`${AXON_API_URL}/webhook/create-api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-axon-signup-secret": secret,
    },
    body: JSON.stringify({
      user_id: userId,
      email,
      user_name: fullName,
      name: keyName ?? (force ? "Regenerated key" : "Default key"),
      plan: (meta.axonPlan as string) ?? "free",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: "Key provisioning failed" },
      { status: 502 }
    );
  }

  const data = await res.json();
  if (!data?.api_key) {
    return NextResponse.json(
      { error: "Backend returned no key" },
      { status: 502 }
    );
  }

  await client.users.updateUserMetadata(userId, {
    privateMetadata: {
      axonApiKey: data.api_key,
      axonKeyPrefix: data.key_prefix ?? String(data.api_key).slice(0, 20),
      axonPlan: data.plan ?? "free",
    },
  });

  return NextResponse.json({
    apiKey: data.api_key,
    keyPrefix: data.key_prefix ?? String(data.api_key).slice(0, 20),
    plan: data.plan ?? "free",
    newlyCreated: true,
  });
}

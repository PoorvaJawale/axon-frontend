import { auth, clerkClient } from "@clerk/nextjs/server";

export const AXON_API_URL =
  process.env.AXON_API_URL || "https://axon-n8n-production-1512.up.railway.app";

/**
 * Resolve the signed-in Clerk user and their Axon API key
 * (stored server-side in Clerk privateMetadata — never sent to the browser).
 */
export async function getAxonContext() {
  const { userId } = await auth();
  if (!userId) return null;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const apiKey = user.privateMetadata?.axonApiKey as string | undefined;
  if (!apiKey) return null;

  return { userId, user, apiKey };
}

/**
 * Set a user's plan everywhere it lives: Clerk privateMetadata (drives the UI)
 * and the api_keys table via the n8n billing-update webhook (drives quota
 * enforcement). Guarded by the shared signup secret.
 */
export async function setUserPlan(
  userId: string,
  plan: "free" | "pro" | "enterprise",
  requestLimit: number
) {
  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    privateMetadata: { axonPlan: plan },
  });

  const secret = process.env.AXON_SIGNUP_SECRET;
  if (!secret) throw new Error("AXON_SIGNUP_SECRET not configured");

  const res = await fetch(`${AXON_API_URL}/webhook/billing-update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-axon-signup-secret": secret,
    },
    body: JSON.stringify({ user_id: userId, plan, request_limit: requestLimit }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`billing-update failed with status ${res.status}`);
  }
}

/** GET an Axon backend endpoint with the user's API key. */
export async function axonGet(path: string, apiKey: string) {
  const res = await fetch(`${AXON_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: null };
  }
}

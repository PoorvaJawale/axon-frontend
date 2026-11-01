import "server-only";
import { createHash } from "node:crypto";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/security/http";
/** Shared PostgreSQL window; failures reject requests rather than silently disabling protection. */
export async function limitRequest(
  scope: string,
  identity: string,
  maximum: number,
  seconds = 60,
) {
  const key = createHash("sha256")
    .update(scope + ":" + identity)
    .digest("hex");
  const rows = await query<{ allowed: boolean }>(
    "SELECT axon_security.take_rate_limit($1,$2,$3) AS allowed",
    [key, maximum, seconds],
  );
  if (!rows[0]?.allowed)
    throw new HttpError(
      429,
      "RATE_LIMITED",
      "Too many requests. Please wait before trying again.",
    );
}

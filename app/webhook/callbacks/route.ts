import { randomBytes, createHash } from "node:crypto";
import { accountRoute } from "@/lib/account";
import { query, transaction } from "@/lib/db";
import { readObject, HttpError } from "@/lib/security/http";
import { callbackUrl, pinnedPost } from "@/backend/n8n/policy.cjs";
export async function GET(request: Request) {
  return accountRoute(request, async (userId) => ({
    destinations: await query(
      "SELECT url,verified_at FROM axon_security.callback_destinations WHERE user_id=$1 ORDER BY created_at DESC",
      [userId],
    ),
  }));
}
export async function POST(request: Request) {
  return accountRoute(
    request,
    async (userId) => {
      const b = await readObject(request);
      let url: string;
      try {
        url = callbackUrl(b.url).href;
      } catch {
        throw new HttpError(
          400,
          "INVALID_CALLBACK",
          "Use an HTTPS hostname on port 443, without credentials, a query, or a fragment.",
        );
      }
      if (b.action === "register") {
        const challenge = randomBytes(32).toString("hex");
        await transaction(async (db) => {
          await db.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
            ["callbacks:" + userId],
          );
          const existing = await db.query(
            "SELECT verified_at FROM axon_security.callback_destinations WHERE user_id=$1 AND url=$2",
            [userId, url],
          );
          if (existing.rows[0]?.verified_at)
            throw new HttpError(
              409,
              "ALREADY_VERIFIED",
              "This destination is verified. Remove it before replacing its signing secret.",
            );
          const count = await db.query(
            "SELECT count(*)::int AS n FROM axon_security.callback_destinations WHERE user_id=$1",
            [userId],
          );
          if (count.rows[0].n >= 5 && !existing.rows.length)
            throw new HttpError(
              409,
              "DESTINATION_LIMIT",
              "Remove an unused destination first.",
            );
          await db.query(
            "INSERT INTO axon_security.callback_destinations(user_id,url,challenge_hash,signing_secret) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,url) DO UPDATE SET challenge_hash=EXCLUDED.challenge_hash,signing_secret=EXCLUDED.signing_secret,verified_at=NULL,created_at=now()",
            [
              userId,
              url,
              createHash("sha256").update(challenge).digest("hex"),
              randomBytes(32).toString("hex"),
            ],
          );
        });
        return {
          challenge,
          instructions:
            "On Axon's verification POST, return JSON with the same challenge value. Then verify within 15 minutes.",
        };
      }
      if (b.action === "delete") {
        await query(
          "DELETE FROM axon_security.callback_destinations WHERE user_id=$1 AND url=$2",
          [userId, url],
        );
        return { success: true };
      }
      if (
        b.action !== "verify" ||
        typeof b.challenge !== "string" ||
        !/^[a-f0-9]{64}$/.test(b.challenge)
      )
        throw new HttpError(
          400,
          "INVALID_CHALLENGE",
          "Register this destination before verifying it.",
        );
      const digest = createHash("sha256").update(b.challenge).digest("hex");
      const rows = await query(
        "SELECT challenge_hash FROM axon_security.callback_destinations WHERE user_id=$1 AND url=$2 AND challenge_hash=$3 AND verified_at IS NULL AND created_at>now()-interval '15 minutes'",
        [userId, url, digest],
      );
      if (!rows.length)
        throw new HttpError(
          409,
          "CHALLENGE_EXPIRED",
          "Register this destination again to get a new challenge.",
        );
      let echoed: unknown;
      try {
        echoed = JSON.parse(
          String(
            await pinnedPost(
              url,
              JSON.stringify({
                type: "axon.destination_verification",
                challenge: b.challenge,
              }),
            ),
          ),
        );
      } catch {
        throw new HttpError(
          422,
          "VERIFICATION_FAILED",
          "The public HTTPS endpoint must return the challenge as JSON. Private addresses and redirects are rejected.",
        );
      }
      if (
        !echoed ||
        typeof echoed !== "object" ||
        !("challenge" in echoed) ||
        echoed.challenge !== b.challenge
      )
        throw new HttpError(
          422,
          "VERIFICATION_FAILED",
          "The endpoint did not return the expected challenge.",
        );
      const saved = await query(
        "UPDATE axon_security.callback_destinations SET verified_at=now() WHERE user_id=$1 AND url=$2 AND challenge_hash=$3 AND verified_at IS NULL RETURNING signing_secret",
        [userId, url, digest],
      );
      if (!saved.length)
        throw new HttpError(
          409,
          "VERIFICATION_CHANGED",
          "Registration changed. Register again.",
        );
      return { success: true, signingSecret: saved[0].signing_secret };
    },
    { write: true, scope: "callback-settings", maximum: 5 },
  );
}

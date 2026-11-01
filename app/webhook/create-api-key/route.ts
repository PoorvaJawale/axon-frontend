import { clerkClient } from "@clerk/nextjs/server";
import { randomBytes, createHash } from "node:crypto";
import { accountRoute } from "@/lib/account";
import { transaction } from "@/lib/db";
import {
  readObject,
  readText,
  boundedString,
  HttpError,
} from "@/lib/security/http";
export async function POST(request: Request) {
  return accountRoute(
    request,
    async (userId) => {
      let body: Record<string, unknown> = {};
      if (request.body) {
        if (!request.headers.get("content-type")) {
          // Proxies can represent a bodyless POST as an empty stream without
          // Content-Length. Preserve default provisioning for that request.
          if ((await readText(request)).length)
            throw new HttpError(415, "JSON_REQUIRED", "Send JSON content.");
        } else body = await readObject(request);
      }
      const name =
        body.name === undefined ? undefined : boundedString(body.name, 60);
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      if (user.primaryEmailAddress?.verification?.status !== "verified")
        throw new HttpError(
          403,
          "EMAIL_VERIFICATION_REQUIRED",
          "Verify your email before creating an API key.",
        );
      const result = await transaction(async (db) => {
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          "provision:" + userId,
        ]);
        const closing = await db.query(
          "SELECT 1 FROM axon_security.privacy_requests WHERE user_id=$1 AND kind='delete' AND state IN ('processing','completed')",
          [userId],
        );
        if (closing.rows.length)
          throw new HttpError(
            409,
            "ACCOUNT_CLOSING",
            "Account deletion is being processed. Contact support before creating keys.",
          );
        const existing = await db.query(
          "SELECT key_prefix FROM public.api_keys WHERE user_id=$1 AND is_active=true AND expires_at>now() ORDER BY created_at DESC",
          [userId],
        );
        if (existing.rows.length && !name && body.force !== true)
          return {
            alreadyProvisioned: true,
            keyPrefix: existing.rows[0].key_prefix,
          };
        if (existing.rows.length >= 20)
          throw new HttpError(
            409,
            "KEY_LIMIT",
            "Revoke an unused key before creating another.",
          );
        const account = await db.query(
          "SELECT plan,custom_limit FROM public.axon_account_quota WHERE user_id=$1 FOR UPDATE",
          [userId],
        );
        if (!account.rows.length) {
          const history = await db.query(
            "SELECT 1 FROM public.api_keys WHERE user_id=$1 LIMIT 1",
            [userId],
          );
          if (history.rows.length)
            throw new HttpError(
              503,
              "ACCOUNT_INITIALIZATION_REQUIRED",
              "Existing usage must be initialized before creating a key.",
            );
          await db.query(
            "INSERT INTO public.axon_account_quota(user_id,plan,free_used,paid_used,custom_limit) VALUES($1,'free',0,0,0)",
            [userId],
          );
        }
        const plan = account.rows[0]?.plan || "free";
        const limit =
          plan === "free"
            ? 100
            : plan === "pro"
              ? 5000
              : Number(account.rows[0].custom_limit);
        const key = "sk-axon-" + randomBytes(24).toString("hex");
        const prefix = key.slice(0, 20);
        await db.query(
          "INSERT INTO public.api_keys(user_id,email,user_name,name,key_prefix,hashed_api_key,webhook_secret,plan,request_limit,monthly_requests,is_active,created_at,updated_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,0,true,now(),now(),now()+interval '90 days')",
          [
            userId,
            user.primaryEmailAddress?.emailAddress || "",
            [user.firstName, user.lastName].filter(Boolean).join(" "),
            name || "Default key",
            prefix,
            createHash("sha256").update(key).digest("hex"),
            randomBytes(32).toString("hex"),
            plan,
            limit,
          ],
        );
        return { apiKey: key, keyPrefix: prefix, plan, newlyCreated: true };
      });
      // Customer secrets are never retained in Clerk. Database hashes remain the validation credential source.
      await client.users
        .updateUserMetadata(userId, {
          privateMetadata: {
            axonApiKey: null,
            axonKeyPrefix: result.keyPrefix,
          },
        })
        .catch(() => console.error("Legacy key metadata cleanup needs retry"));
      return result;
    },
    { write: true, scope: "create-key", maximum: 10 },
  );
}

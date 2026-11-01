import { accountRoute } from "@/lib/account";
import { query } from "@/lib/db";
import { readObject, HttpError } from "@/lib/security/http";
export async function GET(request: Request) {
  return accountRoute(request, async (userId) => ({
    requests: await query(
      "SELECT id,kind,state,created_at,completed_at FROM axon_security.privacy_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20",
      [userId],
    ),
  }));
}
export async function POST(request: Request) {
  return accountRoute(
    request,
    async (userId) => {
      const b = await readObject(request);
      if (
        !["export", "delete"].includes(String(b.kind)) ||
        b.confirmed !== true
      )
        throw new HttpError(
          400,
          "CONFIRMATION_REQUIRED",
          "Confirm whether you are requesting an export or deletion.",
        );
      const rows = await query(
        "INSERT INTO axon_security.privacy_requests(user_id,kind) VALUES($1,$2) ON CONFLICT(user_id,kind) WHERE state IN ('pending','processing') DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id,kind,state",
        [userId, b.kind],
      );
      return {
        request: rows[0],
        message:
          "Your request is recorded for support review. Data has not been deleted or exported yet. Subscription cancellation is managed separately in Billing.",
      };
    },
    { write: true, scope: "privacy-request", maximum: 3 },
  );
}

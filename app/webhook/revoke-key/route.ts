import { accountRoute } from "@/lib/account";
import { query } from "@/lib/db";
import { readObject, positiveInteger, HttpError } from "@/lib/security/http";
export async function POST(request: Request) {
  return accountRoute(
    request,
    async (userId) => {
      const body = await readObject(request);
      const id = positiveInteger(body.keyId, 0, Number.MAX_SAFE_INTEGER);
      const rows = await query(
        "UPDATE public.api_keys SET is_active=false,updated_at=now() WHERE id=$1 AND user_id=$2 RETURNING id",
        [id, userId],
      );
      if (!rows.length)
        throw new HttpError(404, "KEY_NOT_FOUND", "Key was not found.");
      return { success: true };
    },
    { write: true, scope: "revoke-key", maximum: 20 },
  );
}

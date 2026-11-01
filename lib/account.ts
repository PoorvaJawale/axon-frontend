import "server-only";
import { auth } from "@clerk/nextjs/server";
import {
  privateJson,
  failure,
  assertSameOrigin,
  HttpError,
} from "@/lib/security/http";
import { limitRequest } from "@/lib/security/rate-limit";
export async function accountRoute(
  request: Request,
  run: (userId: string) => Promise<unknown>,
  options: { write?: boolean; scope?: string; maximum?: number } = {},
) {
  try {
    if (options.write) assertSameOrigin(request);
    const { userId } = await auth();
    if (!userId)
      throw new HttpError(401, "UNAUTHORIZED", "Sign in to continue.");
    await limitRequest(
      options.scope || "account-read",
      userId,
      options.maximum || 120,
    );
    return privateJson(await run(userId));
  } catch (error) {
    return failure(error);
  }
}

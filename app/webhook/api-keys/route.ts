import { accountRoute } from "@/lib/account";
import { query } from "@/lib/db";
export type ApiKeyRow = {
  id: number;
  name: string;
  keyPrefix: string;
  plan: string;
  isActive: boolean;
  isExpired: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  monthlyRequests: number;
};
export async function GET(request: Request) {
  return accountRoute(request, async (userId) => {
    const rows = await query(
      "SELECT id,name,key_prefix,plan,is_active,created_at,last_used_at,expires_at,monthly_requests FROM public.api_keys WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
      [userId],
    );
    return {
      keys: rows.map((r) => ({
        id: Number(r.id),
        name: r.name,
        keyPrefix: r.key_prefix,
        plan: r.plan,
        isExpired: new Date(r.expires_at).getTime() <= Date.now(),
        isActive:
          !!r.is_active && new Date(r.expires_at).getTime() > Date.now(),
        createdAt: r.created_at,
        lastUsedAt: r.last_used_at,
        expiresAt: r.expires_at,
        monthlyRequests: Number(r.monthly_requests || 0),
      })),
    };
  });
}

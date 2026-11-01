import { accountRoute } from "@/lib/account";
import { transaction } from "@/lib/db";
import { mapLog } from "@/lib/account-data";
import { positiveInteger, boundedString, HttpError } from "@/lib/security/http";
export type WebhookLogEntry = {
  id: string;
  time: string;
  agentId: string;
  actionType: "email" | "database" | "payment" | "chat" | "api_call";
  layerTriggered: string;
  result: "PASS" | "BLOCK" | "ASYNC FLAG";
  reason: string;
  outputContent: string;
};
export async function GET(request: Request) {
  return accountRoute(request, async (userId) => {
    const p = new URL(request.url).searchParams;
    const page = positiveInteger(p.get("page"), 1, 100000),
      limit = positiveInteger(p.get("limit"), 50, 100);
    const verdict = p.get("result") || "All",
      action = p.get("actionType") || "All";
    if (!["All", "PASS", "BLOCK", "ASYNC FLAG"].includes(verdict))
      throw new HttpError(400, "INVALID_FILTER", "Invalid result filter.");
    const actions: Record<string, string> = {
      email: "email_send",
      database: "db_write",
      payment: "payment",
      chat: "live_chat",
      api_call: "api_call",
    };
    if (action !== "All" && !actions[action])
      throw new HttpError(400, "INVALID_FILTER", "Invalid action filter.");
    const hours = p.get("hours");
    if (hours !== null && hours !== "24")
      throw new HttpError(400, "INVALID_FILTER", "Invalid time window.");
    const search = boundedString(p.get("search") || "", 200, false);
    return transaction(async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      const filters =
        "user_id=$1 AND ($5::boolean=false OR timestamp>=now()-interval '24 hours') AND ($2='All' OR final_verdict=$2) AND ($3='All' OR action_type=$3) AND ($4='' OR strpos(lower(COALESCE(reason,'')),lower($4))>0 OR strpos(lower(COALESCE(agent_id,'')),lower($4))>0)";
      const values = [
        userId,
        verdict,
        actions[action] || "All",
        search,
        hours === "24",
      ];
      const count = await db.query(
        "SELECT count(*)::int AS n FROM public.validation_logs WHERE " +
          filters,
        values,
      );
      const rows = await db.query(
        "SELECT * FROM public.validation_logs WHERE " +
          filters +
          " ORDER BY timestamp DESC,id DESC LIMIT $6 OFFSET $7",
        [...values, limit, (page - 1) * limit],
      );
      const stats = await db.query(
        "SELECT count(*)::int AS total,count(*) FILTER(WHERE final_verdict='PASS')::int AS passed,count(*) FILTER(WHERE final_verdict='BLOCK')::int AS blocked,count(*) FILTER(WHERE final_verdict NOT IN ('PASS','BLOCK'))::int AS async_flags FROM public.validation_logs WHERE user_id=$1 AND ($2::boolean=false OR timestamp>=now()-interval '24 hours')",
        [userId, hours === "24"],
      );
      return {
        logs: rows.rows.map(mapLog),
        stats: { ...stats.rows[0], asyncFlags: stats.rows[0].async_flags },
        pagination: {
          currentPage: page,
          limit,
          totalCount: count.rows[0].n,
          totalPages: Math.max(1, Math.ceil(count.rows[0].n / limit)),
        },
      };
    });
  });
}

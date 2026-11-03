import { accountRoute } from "@/lib/account";
import { query, transaction } from "@/lib/db";
import { mapLog } from "@/lib/account-data";
import { readObject, positiveInteger, HttpError } from "@/lib/security/http";
export type WebhookAlert = {
  id: string;
  timestamp: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  blockedOutput: string;
  agentId: string;
  actionType: string;
  reviewed: boolean;
};
export async function GET(request: Request) {
  return accountRoute(request, async (userId) => {
    const params = new URL(request.url).searchParams;
    const filter = params.get("filter") || "All";
    const page = positiveInteger(params.get("page"), 1, 100000);
    const limit = positiveInteger(params.get("limit"), 50, 100);
    if (!["All", "Reviewed", "Unreviewed"].includes(filter))
      throw new HttpError(400, "INVALID_FILTER", "Invalid alert filter.");
    return transaction(async (db) => {
      await db.query(
        "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
      );
      const from =
        "FROM public.validation_logs l LEFT JOIN axon_security.alert_reviews r ON r.user_id=l.user_id AND r.alert_id=l.id WHERE l.user_id=$1 AND l.final_verdict='BLOCK' AND ($2='All' OR COALESCE(r.reviewed,false)=($2='Reviewed'))";
      const totals = (
        await db.query(
          "SELECT count(*)::int AS n, count(*) FILTER(WHERE upper(COALESCE(l.risk_level,'')) IN ('HIGH','CRITICAL'))::int AS high, count(*) FILTER(WHERE upper(COALESCE(l.risk_level,''))='MEDIUM')::int AS medium, count(*) FILTER(WHERE upper(COALESCE(l.risk_level,'')) NOT IN ('HIGH','CRITICAL','MEDIUM'))::int AS low " +
            from,
          [userId, filter],
        )
      ).rows[0];
      const totalPages = Math.max(1, Math.ceil(totals.n / limit));
      const currentPage = Math.min(page, totalPages);
      const rows = await db.query(
        "SELECT l.*,COALESCE(r.reviewed,false) AS reviewed " +
          from +
          " ORDER BY l.timestamp DESC,l.id DESC LIMIT $3 OFFSET $4",
        [userId, filter, limit, (currentPage - 1) * limit],
      );
      return {
        alerts: rows.rows.map((r) => {
          const l = mapLog(r);
          return {
            id: l.id,
            timestamp: l.time,
            severity: ["HIGH", "CRITICAL"].includes(
              String(r.risk_level).toUpperCase(),
            )
              ? "HIGH"
              : String(r.risk_level).toUpperCase() === "MEDIUM"
                ? "MEDIUM"
                : "LOW",
            title: "Blocked " + l.actionType + " output",
            description: l.reason,
            blockedOutput: l.outputContent,
            agentId: l.agentId,
            actionType: l.actionType,
            reviewed: !!r.reviewed,
          };
        }),
        counts: { HIGH: totals.high, MEDIUM: totals.medium, LOW: totals.low },
        pagination: { currentPage, limit, totalCount: totals.n, totalPages },
      };
    });
  });
}
export async function POST(request: Request) {
  return accountRoute(
    request,
    async (userId) => {
      const b = await readObject(request);
      const id = positiveInteger(b.alertId, 0, Number.MAX_SAFE_INTEGER);
      if (!id || typeof b.reviewed !== "boolean")
        throw new HttpError(
          400,
          "INVALID_FIELD",
          "Supply an alert ID and a boolean review state.",
        );
      const rows = await query(
        "INSERT INTO axon_security.alert_reviews(user_id,alert_id,reviewed,reviewed_at) SELECT $1,id,$3,now() FROM public.validation_logs WHERE user_id=$1 AND id=$2 AND final_verdict='BLOCK' ON CONFLICT(user_id,alert_id) DO UPDATE SET reviewed=EXCLUDED.reviewed,reviewed_at=EXCLUDED.reviewed_at RETURNING alert_id",
        [userId, id, b.reviewed],
      );
      if (!rows.length)
        throw new HttpError(404, "NOT_FOUND", "Alert not found.");
      return { success: true, reviewed: b.reviewed };
    },
    { write: true, scope: "alert-review", maximum: 30 },
  );
}

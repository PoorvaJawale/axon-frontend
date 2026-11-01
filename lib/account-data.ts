import "server-only";
import { query } from "@/lib/db";
import { HttpError } from "@/lib/security/http";
export async function accountUsage(userId: string) {
  const rows = await query(
    "SELECT plan, free_used, paid_used, custom_limit, period_start, period_end, (plan='free' OR (now()>=period_start AND now()<period_end)) AS period_active FROM public.axon_account_quota WHERE user_id=$1",
    [userId],
  );
  const a = rows[0];
  if (!a || !["free", "pro", "enterprise"].includes(a.plan))
    throw new HttpError(
      503,
      "ACCOUNT_INITIALIZATION_REQUIRED",
      "Account usage needs initialization. Contact support; your existing usage has not been reset.",
    );
  const used = Number(a.plan === "free" ? a.free_used : a.paid_used);
  const limit =
    a.plan === "free" ? 100 : a.plan === "pro" ? 5000 : Number(a.custom_limit);
  if (
    !Number.isSafeInteger(used) ||
    used < 0 ||
    !Number.isSafeInteger(limit) ||
    limit <= 0
  )
    throw new HttpError(
      503,
      "INVALID_QUOTA_STATE",
      "Account usage needs support review.",
    );
  return {
    plan: a.plan,
    monthly_requests: used,
    request_limit: limit,
    remaining: a.period_active ? Math.max(0, limit - used) : 0,
    period_start: a.period_start,
    period_end: a.period_end,
    period_active: !!a.period_active,
    quota_period: a.plan === "free" ? "lifetime" : "billing_period",
  };
}
export function mapLog(r: Record<string, unknown>) {
  const actions: Record<string, string> = {
    email_send: "email",
    db_write: "database",
    live_chat: "chat",
    payment: "payment",
    api_call: "api_call",
  };
  const raw = r.raw_output;
  const content =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>).content
      : null;
  const verdict = String(r.final_verdict ?? "");
  return {
    id: String(r.id),
    time: new Date(String(r.timestamp))
      .toISOString()
      .replace("T", " ")
      .slice(0, 19),
    agentId: String(r.agent_id || "Not recorded"),
    actionType: actions[String(r.action_type)] || String(r.action_type),
    layerTriggered:
      r.schema_result === "FAILED" ? "Schema validation" : "Semantic judge",
    result:
      verdict === "PASS"
        ? "PASS"
        : verdict === "BLOCK"
          ? "BLOCK"
          : "ASYNC FLAG",
    reason: String(r.reason || ""),
    outputContent:
      typeof content === "string"
        ? content
        : content
          ? JSON.stringify(content)
          : "",
  };
}

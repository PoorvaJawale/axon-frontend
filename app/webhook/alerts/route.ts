import { NextRequest, NextResponse } from "next/server";
import { axonGet, getAxonContext } from "@/lib/axon";

export type WebhookAlert = {
  id: string;
  timestamp: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  blockedOutput: string;
  agentId: string;
  actionType: "email" | "database" | "payment" | "chat" | "api_call";
  reviewed: boolean;
};

const ACTION_MAP: Record<string, WebhookAlert["actionType"]> = {
  email_send: "email",
  db_write: "database",
  payment: "payment",
  live_chat: "chat",
  api_call: "api_call",
  internal_reasoning: "api_call",
};

function severityOf(risk: unknown): WebhookAlert["severity"] {
  const r = String(risk ?? "").toUpperCase();
  if (r === "CRITICAL" || r === "HIGH") return "HIGH";
  if (r === "MEDIUM") return "MEDIUM";
  return "LOW";
}

function titleOf(category: unknown, actionType: string): string {
  const c = String(category ?? "").trim();
  const labels: Record<string, string> = {
    HALLUCINATION: "Hallucinated Content Blocked",
    POLICY: "Policy Violation Blocked",
    SAFETY: "Unsafe Output Blocked",
    COMPLIANCE: "Compliance Issue Blocked",
  };
  return labels[c.toUpperCase()] ?? `Blocked ${actionType} output`;
}

export async function GET(_req: NextRequest) {
  const ctx = await getAxonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ok, data } = await axonGet("/webhook/alerts", ctx.apiKey);
  if (!ok) {
    return NextResponse.json({ error: "Alerts unavailable" }, { status: 502 });
  }

  const rows: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : data
      ? [data]
      : [];

  const alerts: WebhookAlert[] = rows
    .filter((r) => r && r.id !== undefined)
    .map((row) => {
      const actionType = ACTION_MAP[String(row.action_type)] ?? "api_call";
      return {
        id: String(row.id),
        timestamp: String(row.timestamp ?? "").replace("T", " ").slice(0, 19),
        severity: severityOf(row.risk_level),
        title: titleOf(row.category, actionType),
        description: String(row.reason ?? "Semantic validation failed"),
        blockedOutput: String(row.reason ?? ""),
        agentId: String(row.user_id ?? "—"),
        actionType,
        reviewed: false,
      };
    });

  const { searchParams } = new URL(_req.url);
  const filter = searchParams.get("filter") || "All";
  // Review state is not persisted server-side yet — everything is "Unreviewed".
  const result = filter === "Reviewed" ? [] : alerts;

  return NextResponse.json({ alerts: result });
}

export async function POST(req: NextRequest) {
  const ctx = await getAxonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Reviewed-state persistence needs a backend column; acknowledged as no-op for now.
  try {
    await req.json();
  } catch {}
  return NextResponse.json({ success: true });
}

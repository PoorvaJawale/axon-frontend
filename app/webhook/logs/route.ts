import { NextRequest, NextResponse } from "next/server";
import { axonGet, getAxonContext } from "@/lib/axon";

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

const ACTION_MAP: Record<string, WebhookLogEntry["actionType"]> = {
  email_send: "email",
  db_write: "database",
  payment: "payment",
  live_chat: "chat",
  api_call: "api_call",
  internal_reasoning: "api_call",
};

function mapRow(row: Record<string, unknown>): WebhookLogEntry {
  const raw = row.raw_output as { content?: unknown } | string | null;
  let output = "";
  if (raw && typeof raw === "object") {
    output =
      typeof raw.content === "string"
        ? raw.content
        : JSON.stringify(raw.content ?? raw);
  } else if (typeof raw === "string") {
    output = raw;
  }

  return {
    id: String(row.id ?? ""),
    time: String(row.timestamp ?? "").replace("T", " ").slice(0, 19),
    agentId: String(row.user_id ?? "—"),
    actionType: ACTION_MAP[String(row.action_type)] ?? "api_call",
    layerTriggered:
      row.schema_result === "FAILED" ? "Schema validation" : "Semantic judge",
    result: row.final_verdict === "PASS" ? "PASS" : "BLOCK",
    reason: String(row.reason ?? ""),
    outputContent: output,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await getAxonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ok, data } = await axonGet("/webhook/logs?limit=200", ctx.apiKey);
  if (!ok) {
    return NextResponse.json({ error: "Logs unavailable" }, { status: 502 });
  }

  const rows: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : data
      ? [data]
      : [];
  const allLogs = rows.filter((r) => r && r.id !== undefined).map(mapRow);

  const stats = {
    total: allLogs.length,
    passed: allLogs.filter((l) => l.result === "PASS").length,
    blocked: allLogs.filter((l) => l.result === "BLOCK").length,
    asyncFlags: allLogs.filter((l) => l.result === "ASYNC FLAG").length,
  };

  // Same filter/pagination contract the dashboard already uses
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const resultFilter = searchParams.get("result") || "All";
  const actionTypeFilter = searchParams.get("actionType") || "All";
  const searchQuery = (searchParams.get("search") || "").toLowerCase();

  let filtered = [...allLogs];
  if (resultFilter !== "All") {
    filtered = filtered.filter(
      (l) => l.result.toLowerCase() === resultFilter.toLowerCase()
    );
  }
  if (actionTypeFilter !== "All") {
    filtered = filtered.filter(
      (l) => l.actionType.toLowerCase() === actionTypeFilter.toLowerCase()
    );
  }
  if (searchQuery) {
    filtered = filtered.filter(
      (l) =>
        l.agentId.toLowerCase().includes(searchQuery) ||
        l.reason.toLowerCase().includes(searchQuery) ||
        l.outputContent.toLowerCase().includes(searchQuery)
    );
  }

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const startIndex = (page - 1) * limit;

  return NextResponse.json({
    logs: filtered.slice(startIndex, startIndex + limit),
    stats,
    pagination: { currentPage: page, limit, totalCount, totalPages },
  });
}

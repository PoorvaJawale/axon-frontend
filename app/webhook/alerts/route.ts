import { NextRequest, NextResponse } from "next/server";

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

// Global in-memory list of alerts to simulate persistence
let mockAlerts: WebhookAlert[] = [
  {
    id: "alert-1",
    timestamp: "2026-06-07 12:10:12",
    severity: "HIGH",
    title: "SQL Injection Attempt Blocked",
    description: "The AI agent generated an output containing active SQL injection commands that could lead to data loss or execution of unauthorized operations.",
    blockedOutput: "SELECT * FROM users WHERE id = '1' OR '1'='1'; DROP TABLE users; --",
    agentId: "sql-generator-bot",
    actionType: "database",
    reviewed: false,
  },
  {
    id: "alert-2",
    timestamp: "2026-06-07 11:45:09",
    severity: "HIGH",
    title: "Outbound SSRF Attempt Stopped",
    description: "The AI agent attempted to issue a fetch request directed at the AWS EC2 internal metadata link, suggesting Server-Side Request Forgery.",
    blockedOutput: "fetch('http://169.254.169.254/latest/meta-data/')",
    agentId: "github-sync-agent",
    actionType: "api_call",
    reviewed: false,
  },
  {
    id: "alert-3",
    timestamp: "2026-06-07 11:15:42",
    severity: "MEDIUM",
    title: "Exposed Sensitive PII Detected",
    description: "AI email output was flagged for containing an exposed Social Security Number pattern matching a real user's details.",
    blockedOutput: "Hello recruiter, the client profile details are: SSN: 999-12-1234, Cell: 555-0199.",
    agentId: "lead-email-generator",
    actionType: "email",
    reviewed: false,
  },
  {
    id: "alert-4",
    timestamp: "2026-06-07 10:45:00",
    severity: "HIGH",
    title: "High-Value Transaction Threshold Exceeded",
    description: "Stripe checkout billing parameters exceeded the maximum single transaction limit of $10,000.",
    blockedOutput: '{\n  "amount": 1500000,\n  "currency": "usd",\n  "customer_id": "cus_123456"\n}',
    agentId: "checkout-helper",
    actionType: "payment",
    reviewed: false,
  },
  {
    id: "alert-5",
    timestamp: "2026-06-06 23:45:00",
    severity: "MEDIUM",
    title: "Outbound API Token Leak Blocked",
    description: "Outbound API request headers contained an unredacted GitHub Personal Access Token.",
    blockedOutput: "GET https://api.github.com/user\nAuthorization: token ghp_mocktokenplaceholder",
    agentId: "github-sync-agent",
    actionType: "api_call",
    reviewed: true,
  }
];

export async function GET(req: NextRequest) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") || "All";

  let resultAlerts = [...mockAlerts];

  if (filter === "Reviewed") {
    resultAlerts = resultAlerts.filter((a) => a.reviewed);
  } else if (filter === "Unreviewed") {
    resultAlerts = resultAlerts.filter((a) => !a.reviewed);
  }

  return NextResponse.json({ alerts: resultAlerts });
}

// Allow toggling checked/reviewed status
export async function POST(req: NextRequest) {
  try {
    const { alertId, reviewed } = await req.json();
    mockAlerts = mockAlerts.map((alert) =>
      alert.id === alertId ? { ...alert, reviewed } : alert
    );
    return NextResponse.json({ success: true, alerts: mockAlerts });
  } catch (err) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";

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

// Generate a larger set of mock logs for sorting, filtering, and pagination testing
const mockLogs: WebhookLogEntry[] = [
  {
    id: "1",
    time: "2026-06-07 12:15:33",
    agentId: "support-agent-v2",
    actionType: "chat",
    layerTriggered: "Semantic alignment",
    result: "PASS",
    reason: "Output matches safety and tone rules",
    outputContent: "Hello! I can help you update your email address in your billing profile. Let's get started.",
  },
  {
    id: "2",
    time: "2026-06-07 12:10:12",
    agentId: "sql-generator-bot",
    actionType: "database",
    layerTriggered: "SQL Injection detector",
    result: "BLOCK",
    reason: "Detected potential SQL injection pattern",
    outputContent: "SELECT * FROM users WHERE id = '1' OR '1'='1'; DROP TABLE users; --",
  },
  {
    id: "3",
    time: "2026-06-07 12:08:45",
    agentId: "notifications-bot",
    actionType: "email",
    layerTriggered: "Link verification filter",
    result: "ASYNC FLAG",
    reason: "Response contains unverified external links",
    outputContent: "Hi there, your package is ready. Track it here: http://suspicious-unverified-tracker.com/package-info",
  },
  {
    id: "4",
    time: "2026-06-07 11:58:20",
    agentId: "checkout-helper",
    actionType: "payment",
    layerTriggered: "Metadata validation",
    result: "PASS",
    reason: "Stripe billing metadata structured correctly",
    outputContent: '{\n  "amount": 2900,\n  "currency": "usd",\n  "customer_id": "cus_987654"\n}',
  },
  {
    id: "5",
    time: "2026-06-07 11:45:09",
    agentId: "github-sync-agent",
    actionType: "api_call",
    layerTriggered: "SSRF blocker",
    result: "BLOCK",
    reason: "Attempted file system access / SSRF outside local range",
    outputContent: "fetch('http://169.254.169.254/latest/meta-data/')",
  },
  {
    id: "6",
    time: "2026-06-07 11:30:15",
    agentId: "customer-feedback-bot",
    actionType: "chat",
    layerTriggered: "Toxicity score",
    result: "PASS",
    reason: "Feedback response passes toxicity threshold of 0.1",
    outputContent: "Thank you for sharing your experience. We are sorry for the delay and will process your refund immediately.",
  },
  {
    id: "7",
    time: "2026-06-07 11:15:42",
    agentId: "lead-email-generator",
    actionType: "email",
    layerTriggered: "PII leak detector",
    result: "BLOCK",
    reason: "Attempted email output containing exposed SSNs",
    outputContent: "Hello recruiter, the client profile details are: SSN: 999-12-1234, Cell: 555-0199.",
  },
  {
    id: "8",
    time: "2026-06-07 10:45:00",
    agentId: "checkout-helper",
    actionType: "payment",
    layerTriggered: "Fraud limit checker",
    result: "BLOCK",
    reason: "Suspicious checkout transaction amount exceeding $10,000 limit",
    outputContent: '{\n  "amount": 1500000,\n  "currency": "usd",\n  "customer_id": "cus_123456"\n}',
  },
  {
    id: "9",
    time: "2026-06-07 10:30:11",
    agentId: "support-agent-v2",
    actionType: "chat",
    layerTriggered: "PII redaction filter",
    result: "ASYNC FLAG",
    reason: "Contains potential cell numbers - flagged for human audit",
    outputContent: "Sure, I can text you the information. Is this your number? +1-415-555-2671",
  },
  {
    id: "10",
    time: "2026-06-07 09:12:05",
    agentId: "slack-notifier",
    actionType: "api_call",
    layerTriggered: "API Key scanning",
    result: "PASS",
    reason: "Safe HTTP payload - no leaked auth headers detected",
    outputContent: 'POST https://slack.com/webhooks/mock-service-integration-endpoint\nContent-Type: application/json\n{\n  "text": "Daily build completed successfully."\n}',
  },
  {
    id: "11",
    time: "2026-06-07 08:55:00",
    agentId: "support-agent-v2",
    actionType: "chat",
    layerTriggered: "Prompt injection guard",
    result: "PASS",
    reason: "Clean conversational output",
    outputContent: "I understand your request. Let me look up your order details in the system.",
  },
  {
    id: "12",
    time: "2026-06-07 08:44:12",
    agentId: "sql-generator-bot",
    actionType: "database",
    layerTriggered: "Read-only enforcement",
    result: "BLOCK",
    reason: "Write operation query blocked in read-only environment",
    outputContent: "UPDATE accounts SET balance = 1000000 WHERE id = 42;",
  },
  {
    id: "13",
    time: "2026-06-07 08:12:30",
    agentId: "sales-assistant",
    actionType: "chat",
    layerTriggered: "Semantic guardrail",
    result: "PASS",
    reason: "Approved sales copy alignment",
    outputContent: "Axon Pro plan starts at $29/month, which covers up to 10,000 validations per month.",
  },
  {
    id: "14",
    time: "2026-06-07 07:15:10",
    agentId: "lead-email-generator",
    actionType: "email",
    layerTriggered: "Spam check filter",
    result: "PASS",
    reason: "Spam threshold checks passed",
    outputContent: "Here is the summary report of our latest quarterly analytics. Please find the attachments below.",
  },
  {
    id: "15",
    time: "2026-06-06 23:45:00",
    agentId: "github-sync-agent",
    actionType: "api_call",
    layerTriggered: "Token scanner",
    result: "BLOCK",
    reason: "Outbound API request leaks Bearer authentication token",
    outputContent: "GET https://api.github.com/user\nAuthorization: token ghp_mocktokenplaceholder",
  },
  {
    id: "16",
    time: "2026-06-06 22:30:19",
    agentId: "sql-generator-bot",
    actionType: "database",
    layerTriggered: "SQL schema validator",
    result: "PASS",
    reason: "Valid query structure",
    outputContent: "SELECT name, email FROM clients WHERE active = true ORDER BY signup_date DESC LIMIT 5;",
  },
  {
    id: "17",
    time: "2026-06-06 21:12:44",
    agentId: "support-agent-v2",
    actionType: "chat",
    layerTriggered: "PII redaction filter",
    result: "PASS",
    reason: "Redaction checks completed cleanly",
    outputContent: "I have successfully registered your ticket. Our specialist will respond via email.",
  },
  {
    id: "18",
    time: "2026-06-06 20:55:00",
    agentId: "checkout-helper",
    actionType: "payment",
    layerTriggered: "Metadata validation",
    result: "PASS",
    reason: "Valid transaction structure",
    outputContent: '{\n  "amount": 9900,\n  "currency": "usd",\n  "card_brand": "visa"\n}',
  },
  {
    id: "19",
    time: "2026-06-06 19:44:10",
    agentId: "notifications-bot",
    actionType: "email",
    layerTriggered: "Link verification filter",
    result: "PASS",
    reason: "All links match whitelist domains",
    outputContent: "Click here to login: https://axon-middleware.com/dashboard",
  },
  {
    id: "20",
    time: "2026-06-06 18:30:12",
    agentId: "sales-assistant",
    actionType: "chat",
    layerTriggered: "Tone evaluation",
    result: "ASYNC FLAG",
    reason: "Tone exceeds conversational informality limits",
    outputContent: "Yo what's up, you'll get huge discounts if you buy now. Text me back asap!",
  }
];

export async function GET(req: NextRequest) {
  // Simulate delay
  await new Promise((resolve) => setTimeout(resolve, 400));

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const resultFilter = searchParams.get("result") || "All";
  const actionTypeFilter = searchParams.get("actionType") || "All";
  const searchQuery = searchParams.get("search") || "";

  // Filter logs
  let filteredLogs = [...mockLogs];

  if (resultFilter !== "All") {
    filteredLogs = filteredLogs.filter(
      (log) => log.result.toLowerCase() === resultFilter.toLowerCase()
    );
  }

  if (actionTypeFilter !== "All") {
    filteredLogs = filteredLogs.filter(
      (log) => log.actionType.toLowerCase() === actionTypeFilter.toLowerCase()
    );
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredLogs = filteredLogs.filter(
      (log) =>
        log.agentId.toLowerCase().includes(q) ||
        log.reason.toLowerCase().includes(q) ||
        log.outputContent.toLowerCase().includes(q)
    );
  }

  // Calculate statistics
  const stats = {
    total: mockLogs.length,
    passed: mockLogs.filter((l) => l.result === "PASS").length,
    blocked: mockLogs.filter((l) => l.result === "BLOCK").length,
    asyncFlags: mockLogs.filter((l) => l.result === "ASYNC FLAG").length,
  };

  // Paginate
  const totalCount = filteredLogs.length;
  const totalPages = Math.ceil(totalCount / limit);
  const startIndex = (page - 1) * limit;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + limit);

  return NextResponse.json({
    logs: paginatedLogs,
    stats,
    pagination: {
      currentPage: page,
      limit,
      totalCount,
      totalPages,
    },
  });
}

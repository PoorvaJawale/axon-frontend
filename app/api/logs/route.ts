import { NextResponse } from "next/server";

export type LogEntry = {
  id: string;
  time: string;
  actionType: string;
  result: "PASS" | "BLOCK" | "ASYNC FLAG";
  reason: string;
};

const mockLogs: LogEntry[] = [
  {
    id: "1",
    time: "2024-01-15 14:32:01",
    actionType: "Text Generation",
    result: "PASS",
    reason: "Output matches schema constraints",
  },
  {
    id: "2",
    time: "2024-01-15 14:31:45",
    actionType: "Code Execution",
    result: "BLOCK",
    reason: "Detected potential SQL injection pattern",
  },
  {
    id: "3",
    time: "2024-01-15 14:31:22",
    actionType: "API Response",
    result: "ASYNC FLAG",
    reason: "Response contains unverified external links",
  },
  {
    id: "4",
    time: "2024-01-15 14:30:58",
    actionType: "Text Generation",
    result: "PASS",
    reason: "Content within safety guidelines",
  },
  {
    id: "5",
    time: "2024-01-15 14:30:33",
    actionType: "Data Extraction",
    result: "PASS",
    reason: "Structured output validated successfully",
  },
  {
    id: "6",
    time: "2024-01-15 14:30:12",
    actionType: "Code Execution",
    result: "BLOCK",
    reason: "Attempted file system access outside sandbox",
  },
  {
    id: "7",
    time: "2024-01-15 14:29:55",
    actionType: "Text Generation",
    result: "ASYNC FLAG",
    reason: "Contains medical advice - requires human review",
  },
  {
    id: "8",
    time: "2024-01-15 14:29:30",
    actionType: "API Response",
    result: "PASS",
    reason: "JSON schema validation passed",
  },
];

export async function GET() {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const stats = {
    total: mockLogs.length,
    passed: mockLogs.filter((l) => l.result === "PASS").length,
    blocked: mockLogs.filter((l) => l.result === "BLOCK").length,
    asyncFlags: mockLogs.filter((l) => l.result === "ASYNC FLAG").length,
  };

  return NextResponse.json({ logs: mockLogs, stats });
}

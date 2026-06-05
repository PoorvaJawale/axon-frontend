import { NextResponse } from "next/server";

export type Alert = {
  id: string;
  timestamp: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  blockedOutput: string;
  actionType: string;
};

const mockAlerts: Alert[] = [
  {
    id: "1",
    timestamp: "2024-01-15 14:31:45",
    severity: "high",
    title: "SQL Injection Attempt Blocked",
    description:
      "The AI model attempted to generate a response containing SQL injection patterns that could compromise database security.",
    blockedOutput: `SELECT * FROM users WHERE id = '1' OR '1'='1'; DROP TABLE users; --`,
    actionType: "Code Execution",
  },
  {
    id: "2",
    timestamp: "2024-01-15 14:30:12",
    severity: "high",
    title: "Unauthorized File System Access",
    description:
      "Detected attempt to access file system paths outside the designated sandbox environment.",
    blockedOutput: `fs.readFileSync('/etc/passwd', 'utf8')`,
    actionType: "Code Execution",
  },
  {
    id: "3",
    timestamp: "2024-01-15 14:28:33",
    severity: "medium",
    title: "PII Data Exposure Risk",
    description:
      "Response contained patterns matching personally identifiable information that should not be exposed.",
    blockedOutput: `User SSN: 123-45-6789, Credit Card: 4111-1111-1111-1111`,
    actionType: "Text Generation",
  },
];

export async function GET() {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 600));

  return NextResponse.json({ alerts: mockAlerts });
}

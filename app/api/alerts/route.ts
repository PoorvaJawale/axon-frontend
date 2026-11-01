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
export async function GET() {
  return NextResponse.json(
    {
      error:
        "This preview endpoint has been retired. Use the authenticated /webhook/alerts endpoint.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

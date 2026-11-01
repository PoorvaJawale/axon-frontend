import { NextResponse } from "next/server";
export type LogEntry = {
  id: string;
  time: string;
  actionType: string;
  result: "PASS" | "BLOCK" | "ASYNC FLAG";
  reason: string;
};
export async function GET() {
  return NextResponse.json(
    {
      error:
        "This preview endpoint has been retired. Use the authenticated /webhook/logs endpoint.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomStr = "";
  for (let i = 0; i < 24; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const newKey = `sk-axon-${randomStr}`;

  return NextResponse.json({ apiKey: newKey });
}

import { NextResponse } from "next/server";
import { axonGet, getAxonContext } from "@/lib/axon";

export type ApiKeyRow = {
  id: number;
  name: string;
  keyPrefix: string;
  plan: string;
  isActive: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  monthlyRequests: number;
};

export async function GET() {
  const ctx = await getAxonContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ok, data } = await axonGet("/webhook/api-keys", ctx.apiKey);
  if (!ok) {
    return NextResponse.json({ error: "Keys unavailable" }, { status: 502 });
  }

  const rows: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : data
      ? [data]
      : [];

  const keys: ApiKeyRow[] = rows
    .filter((r) => r && r.id !== undefined)
    .map((r) => ({
      id: Number(r.id),
      name: String(r.name ?? "Unnamed key"),
      keyPrefix: String(r.key_prefix ?? ""),
      plan: String(r.plan ?? "free"),
      isActive: r.is_active === true,
      createdAt: (r.created_at as string) ?? null,
      lastUsedAt: (r.last_used_at as string) ?? null,
      expiresAt: (r.expires_at as string) ?? null,
      monthlyRequests: Number(r.monthly_requests ?? 0),
    }))
    // newest first, like OpenAI's key list
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({ keys });
}

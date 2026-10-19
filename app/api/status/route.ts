import { getServiceStatus } from "@/lib/status-checks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, sanitized check results only. Secrets and upstream payloads never leave the server. */
export async function GET() {
  const snapshot = await getServiceStatus();
  return Response.json(snapshot, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=30, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

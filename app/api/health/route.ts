export const dynamic = "force-dynamic";

/** Checks the web server only; it does not claim database or AI availability. */
export async function GET(request: Request) {
  const id = request.headers.get("x-axon-health-request-id") ?? "";
  return Response.json({ service: "axon-web", status: "ok", request_id: id.slice(0, 80) }, {
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

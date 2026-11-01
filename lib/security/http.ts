import { NextResponse } from "next/server";
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(error: unknown) {
  if (error instanceof HttpError)
    return privateJson(
      { code: error.code, error: error.message },
      error.status,
    );
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return privateJson(
    {
      code: "SERVICE_UNAVAILABLE",
      error: "This service is temporarily unavailable. Please try again.",
    },
    503,
  );
}
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.AXON_PUBLIC_SITE_URL || request.url)
    .origin;
  const allowed = new Set([expected]);
  // Trust only this deployment's server-provided hostname, never an incoming
  // Host/Forwarded header or every project under vercel.app.
  const deployment = process.env.VERCEL_URL;
  if (
    process.env.VERCEL === "1" &&
    deployment &&
    /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.vercel\.app$/.test(deployment)
  )
    allowed.add(`https://${deployment}`);
  if (
    (origin && !allowed.has(origin)) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(
      403,
      "ORIGIN_REJECTED",
      "Request origin is not allowed.",
    );
  // Browser mutations must send Origin. Non-browser authenticated integrations are handled by separate routes.
  if (!origin && process.env.NODE_ENV === "production")
    throw new HttpError(403, "ORIGIN_REQUIRED", "Request origin is required.");
}
export async function readText(request: Request, maxBytes = 16_384) {
  const declared = Number(request.headers.get("content-length"));
  if (declared > maxBytes)
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request is too large.");
  if (!request.body) return "";
  const reader = request.body.getReader();
  let size = 0;
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + 5000;
  while (true) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { done, value } = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => {
            reject(
              new HttpError(
                408,
                "BODY_TIMEOUT",
                "The request body took too long to arrive.",
              ),
            );
            void reader.cancel().catch(() => {});
          },
          Math.max(0, deadline - Date.now()),
        );
      }),
    ]).finally(() => clearTimeout(timer));
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request is too large.");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
export async function readObject(
  request: Request,
  maxBytes = 16_384,
): Promise<Record<string, unknown>> {
  if (
    !(request.headers.get("content-type") || "")
      .toLowerCase()
      .includes("application/json")
  )
    throw new HttpError(415, "JSON_REQUIRED", "Send JSON content.");
  try {
    const data = JSON.parse(await readText(request, maxBytes));
    if (!data || Array.isArray(data) || typeof data !== "object")
      throw new Error();
    return data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "INVALID_JSON", "Invalid JSON request.");
  }
}
export function positiveInteger(
  raw: unknown,
  fallback: number,
  maximum: number,
) {
  if (raw === null || raw === undefined || raw === "") {
    if (fallback >= 1) return fallback;
    throw new HttpError(
      400,
      "INVALID_PARAMETER",
      "A numeric parameter is required.",
    );
  }
  if (
    typeof raw !== "number" &&
    (typeof raw !== "string" || !/^[1-9][0-9]*$/.test(raw))
  )
    throw new HttpError(400, "INVALID_PARAMETER", "Supply a positive integer.");
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 1 || n > maximum)
    throw new HttpError(
      400,
      "INVALID_PARAMETER",
      "A numeric parameter is outside its allowed range.",
    );
  return n;
}
export function boundedString(value: unknown, max: number, required = true) {
  if (value === undefined && !required) return "";
  if (
    typeof value !== "string" ||
    (required && !value.trim()) ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw new HttpError(
      400,
      "INVALID_FIELD",
      "A field is missing or too long.",
    );
  return value.trim();
}

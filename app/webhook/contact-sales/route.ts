import {
  assertSameOrigin,
  readObject,
  boundedString,
  failure,
  HttpError,
} from "@/lib/security/http";
import { limitRequest } from "@/lib/security/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const SALES_INBOX = process.env.CONTACT_SALES_TO || "axonapi2026@gmail.com";

/** camelCase / snake_case → "Title Case" for email display */
function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayValue(value: unknown): string {
  if (Array.isArray(value))
    return value.length ? value.join(", ") : "None selected";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    return await contact(req);
  } catch (error) {
    return failure(error);
  }
}
async function contact(req: NextRequest) {
  let data: Record<string, unknown>;
  try {
    data = await readObject(req);
  } catch {
    return NextResponse.json(
      { error: "Invalid form payload" },
      { status: 400 },
    );
  }

  // Vercel overwrites its forwarding header. Other deployments share a conservative global bucket.
  const ip = process.env.VERCEL
    ? req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    : "shared";
  await limitRequest("contact-ip", ip, 3, 3600);
  await limitRequest("contact-global", "all", 50, 3600);
  // Accept the already-shipped billing form names while normalizing one contract.
  data.agentsCount ??= data.agentVolume;
  data.monthlyVolume ??= data.validationEstimate;
  delete data.agentVolume;
  delete data.validationEstimate;
  const allowed = [
    "fullName",
    "workEmail",
    "companyName",
    "jobTitle",
    "agentsCount",
    "monthlyVolume",
    "systems",
    "onPremise",
    "useCase",
    "heardFrom",
  ];
  if (Object.keys(data).some((k) => !allowed.includes(k)))
    throw new HttpError(400, "INVALID_FIELD", "Unexpected form field.");
  for (const key of [
    "fullName",
    "workEmail",
    "companyName",
    "agentsCount",
    "monthlyVolume",
  ])
    data[key] = boundedString(data[key], key === "useCase" ? 2000 : 200);
  if (data.useCase !== undefined)
    data.useCase = boundedString(data.useCase, 2000, false);
  for (const key of ["jobTitle", "heardFrom"])
    if (data[key] !== undefined)
      data[key] = boundedString(data[key], 200, false);
  if (
    typeof data.workEmail !== "string" ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.workEmail)
  )
    throw new HttpError(400, "INVALID_EMAIL", "Enter a valid work email.");
  if (
    data.systems !== undefined &&
    (!Array.isArray(data.systems) ||
      data.systems.length > 6 ||
      data.systems.some((v) => typeof v !== "string" || v.length > 60))
  )
    throw new HttpError(400, "INVALID_FIELD", "Invalid system selection.");
  if (data.onPremise !== undefined && typeof data.onPremise !== "boolean")
    throw new HttpError(400, "INVALID_FIELD", "Invalid deployment preference.");
  const smtpUser = process.env.GMAIL_USER;
  const smtpPass = process.env.GMAIL_APP_PASSWORD;
  if (!smtpUser || !smtpPass) {
    console.error(
      "Contact sales: GMAIL_USER / GMAIL_APP_PASSWORD not configured",
    );
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 },
    );
  }

  const company = String(
    data.companyName ?? data.company_name ?? "Unknown company",
  );
  const senderEmail = String(data.workEmail ?? data.work_email ?? "");

  const rows = Object.entries(data)
    .map(
      ([key, value]) => `
        <tr>
          <td style="padding:8px 14px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;white-space:nowrap;">${escapeHtml(labelize(key))}</td>
          <td style="padding:8px 14px;border:1px solid #e5e7eb;">${escapeHtml(displayValue(value))}</td>
        </tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
      <h2 style="color:#16a34a;border-bottom:2px solid #16a34a;padding-bottom:8px;">
        New Enterprise Inquiry — ${escapeHtml(company)}
      </h2>
      <p style="font-size:14px;color:#4b5563;">
        A new enterprise contact form was submitted on the Axon website.
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">${rows}</table>
      <p style="font-size:12px;color:#9ca3af;margin-top:16px;">
        Sent automatically by the Axon website · reply directly to reach the prospect.
      </p>
    </div>`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: { user: smtpUser, pass: smtpPass },
  });

  try {
    await transporter.sendMail({
      from: `"Axon Website" <${smtpUser}>`,
      to: SALES_INBOX,
      subject: `New Enterprise Inquiry — ${company}`,
      html,
      ...(senderEmail ? { replyTo: senderEmail } : {}),
    });
  } catch (err) {
    console.error(
      "Contact sales: failed to send email",
      err instanceof Error ? err.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Failed to send. Please email us directly." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Thanks! Your inquiry has been sent to the team.",
  });
}

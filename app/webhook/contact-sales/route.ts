import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const SALES_INBOX = process.env.CONTACT_SALES_TO || "axonapiai2026@gmail.com";

/** camelCase / snake_case → "Title Case" for email display */
function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None selected";
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
  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid form payload" }, { status: 400 });
  }

  const smtpUser = process.env.GMAIL_USER;
  const smtpPass = process.env.GMAIL_APP_PASSWORD;
  if (!smtpUser || !smtpPass) {
    console.error("Contact sales: GMAIL_USER / GMAIL_APP_PASSWORD not configured");
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    );
  }

  const company = String(data.companyName ?? data.company_name ?? "Unknown company");
  const senderEmail = String(data.workEmail ?? data.work_email ?? "");

  const rows = Object.entries(data)
    .map(
      ([key, value]) => `
        <tr>
          <td style="padding:8px 14px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:600;white-space:nowrap;">${escapeHtml(labelize(key))}</td>
          <td style="padding:8px 14px;border:1px solid #e5e7eb;">${escapeHtml(displayValue(value))}</td>
        </tr>`
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
    console.error("Contact sales: failed to send email", err);
    return NextResponse.json(
      { error: "Failed to send. Please email us directly." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Thanks! We will reach out within 24 hours.",
  });
}

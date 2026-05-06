import "server-only";

import { Resend } from "resend";
import {
  formatKuwaitDateTime,
  formatKuwaitFullDate,
  formatKuwaitTimeRange,
  formatKwd,
} from "@/lib/time";

// Best-effort booking-confirmation email. Mirrors the SMS sender —
// silently skips when not configured or when the booking has no email
// on file, never throws (an outage at Resend can't take down the
// payment-result page).
//
// Required env vars:
//   RESEND_API_KEY   — re_... key from https://resend.com/api-keys.
//                      Without it, emails are skipped silently.
// Optional env vars:
//   RESEND_FROM      — sender address (default below). Must be from a
//                      verified domain on your Resend account, OR the
//                      free `onboarding@resend.dev` for testing.

const DEFAULT_FROM = "Smash Courts <onboarding@resend.dev>";

type Args = {
  email: string | null; // customer_email from booking row (may be null)
  customerName: string;
  courtName: string;
  startIso: string;
  endIso: string;
  reference: string;
  totalPrice: number;
  // Optional gateway transaction details — populated when MyFatoorah
  // returned an Invoice. We render a "Transaction details" block in
  // the email when these are present.
  transaction: {
    paymentId: string | null;
    transactionId: string | null;
    referenceId: string | null;
    gateway: string | null;
    status: string;
    paidAt: string;
  } | null;
};

export async function sendBookingConfirmationEmail(args: Args): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] Resend not configured — skipping confirmation", {
      reference: args.reference,
    });
    return;
  }

  if (!args.email || !args.email.includes("@")) {
    // Anonymous booking or email left blank — nothing to send to.
    return;
  }

  const date = formatKuwaitFullDate(args.startIso.slice(0, 10));
  const time = formatKuwaitTimeRange(args.startIso, args.endIso);
  const html = renderHtml({ ...args, date, time });
  const text = renderText({ ...args, date, time });

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM ?? DEFAULT_FROM,
      to: args.email,
      subject: `Booking confirmed — ${args.courtName} on ${date}`,
      html,
      text,
    });
    if (error) {
      console.error("[email] booking confirmation send failed", {
        reference: args.reference,
        error: error.message ?? String(error),
      });
    }
  } catch (err) {
    console.error("[email] booking confirmation threw", {
      reference: args.reference,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Rendering ───────────────────────────────────────────────────────
// Inline HTML to avoid a templating dep. Brand-tinted heading, simple
// two-column receipt-style key/value rows, plain-text fallback.

function renderHtml(args: Args & { date: string; time: string }): string {
  const tx = args.transaction;
  const txRows = tx
    ? [
        ["Status", esc(tx.status)],
        ["Gateway", esc(tx.gateway ?? "—")],
        ["Date & time", esc(formatKuwaitDateTime(tx.paidAt))],
        ["Payment ID", monoCell(tx.paymentId)],
        ["Transaction ID", monoCell(tx.transactionId)],
        ["Reference ID", monoCell(tx.referenceId)],
      ]
        .filter(([, v]) => v && v !== "—" && v !== "")
        .map(
          ([label, val]) => `
            <tr>
              <td style="padding:6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;width:140px;vertical-align:top">${label}</td>
              <td style="padding:6px 0;color:#0f172a;font-size:14px;vertical-align:top">${val}</td>
            </tr>`,
        )
        .join("")
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Booking confirmed</title>
  </head>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc">
      <tr>
        <td align="center" style="padding:32px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08)">
            <tr>
              <td style="background:linear-gradient(135deg,#0F766E,#0a5953);padding:24px 24px;color:#ffffff">
                <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#a7f3d0">Booking confirmed</p>
                <h1 style="margin:6px 0 0 0;font-size:22px;font-weight:700">${esc(args.courtName)}</h1>
                <p style="margin:6px 0 0 0;font-size:14px;color:#e0f2fe">${esc(args.date)} · ${esc(args.time)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px">
                <p style="margin:0 0 16px 0;font-size:15px;color:#334155">Hi ${esc(args.customerName)}, your booking is confirmed. See you on the court.</p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin-top:8px">
                  <tr>
                    <td style="padding:16px 0 6px 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Booking</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Reference</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 6px 0;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:18px;font-weight:600;color:#0f172a">${esc(args.reference)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">Total</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 12px 0;font-size:18px;font-weight:600;color:#0f172a">${esc(formatKwd(args.totalPrice))}</td>
                  </tr>
                </table>

                ${
                  tx
                    ? `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin-top:8px">
                  <tr>
                    <td colspan="2" style="padding:16px 0 6px 0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600">Transaction details</td>
                  </tr>
                  ${txRows}
                </table>`
                    : ""
                }

                <p style="margin:24px 0 0 0;padding:12px 14px;background:#f0fdfa;border-radius:8px;font-size:13px;color:#134e4a">
                  Please arrive 5–10 minutes before your slot. Need to cancel? Open <strong>My Account</strong> on Smash Courts before the slot starts.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;background:#0a5953;color:#a7f3d0;font-size:12px;text-align:center">
                Smash Courts Kuwait · Salmiya
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderText(args: Args & { date: string; time: string }): string {
  const lines = [
    `Hi ${args.customerName},`,
    "",
    `Your booking is confirmed.`,
    "",
    `Court:    ${args.courtName}`,
    `Date:     ${args.date}`,
    `Time:     ${args.time}`,
    `Total:    ${formatKwd(args.totalPrice)}`,
    `Ref:      ${args.reference}`,
  ];
  const tx = args.transaction;
  if (tx) {
    lines.push("", "Transaction details");
    lines.push(`Status:   ${tx.status}`);
    if (tx.gateway) lines.push(`Gateway:  ${tx.gateway}`);
    lines.push(`Paid at:  ${formatKuwaitDateTime(tx.paidAt)}`);
    if (tx.paymentId) lines.push(`PaymentID:    ${tx.paymentId}`);
    if (tx.transactionId) lines.push(`TransactionID:${tx.transactionId}`);
    if (tx.referenceId) lines.push(`ReferenceID:  ${tx.referenceId}`);
  }
  lines.push(
    "",
    "Please arrive 5–10 minutes before your slot.",
    "Need to cancel? Open My Account before the slot starts.",
    "",
    "— Smash Courts Kuwait, Salmiya",
  );
  return lines.join("\n");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function monoCell(v: string | null): string {
  if (!v) return "";
  return `<span style="font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:12px;color:#0f172a;word-break:break-all">${esc(v)}</span>`;
}

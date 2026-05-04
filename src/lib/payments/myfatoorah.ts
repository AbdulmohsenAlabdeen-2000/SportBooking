import "server-only";

// Thin wrapper around the MyFatoorah v2 API. We call three endpoints:
//
//   POST /v2/ExecutePayment   — create an invoice and get the hosted
//                                payment URL the customer is redirected to.
//   POST /v2/getPaymentStatus — fetch the current status of a payment
//                                (used by the success-landing page as a
//                                belt-and-braces check on top of webhooks).
//   POST /v2/MakeRefund       — refund a paid invoice on cancellation.
//
// Auth: Bearer token in the Authorization header. The token is the
// API Key from MyFatoorah's portal → Integration Settings → API Token.
//
// Required env vars:
//   MYFATOORAH_API_KEY   — JWT-style token, e.g. "SK_KWT_..." (sandbox)
//                                            or "..." (live)
//   MYFATOORAH_BASE_URL  — "https://apitest.myfatoorah.com" (Kuwait sandbox)
//                       or "https://api.myfatoorah.com"     (Kuwait live)

type Config = {
  apiKey: string;
  baseUrl: string;
};

function readConfig(): Config | null {
  const apiKey = process.env.MYFATOORAH_API_KEY;
  const baseUrl = process.env.MYFATOORAH_BASE_URL;
  if (!apiKey || !baseUrl) return null;
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, "") };
}

export function isMyFatoorahConfigured(): boolean {
  return readConfig() !== null;
}

type MfResponse<T> = { IsSuccess: boolean; Message: string; Data: T };

async function callMf<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const cfg = readConfig();
  if (!cfg) return { ok: false, error: "myfatoorah_not_configured" };

  try {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      | MfResponse<T>
      | null;
    if (!json) {
      return {
        ok: false,
        error: `myfatoorah_http_${res.status}_no_json`,
      };
    }
    if (!json.IsSuccess) {
      return { ok: false, error: json.Message || "myfatoorah_error" };
    }
    return { ok: true, data: json.Data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "network_error",
    };
  }
}

// ─── ExecutePayment ──────────────────────────────────────────────────────────
// Creates an invoice and returns the hosted-payment URL we redirect the
// customer to. PaymentMethodId 2 selects the unified "InvoicePayment"
// page where MyFatoorah lets the customer pick K-Net / Visa / MC /
// Apple Pay etc themselves.

export type ExecutePaymentInput = {
  invoiceAmount: number; // KWD, e.g. 8.000
  customerName: string;
  customerEmail?: string | null;
  customerMobile?: string | null;
  callbackUrl: string; // success
  errorUrl: string; // failure
  customerReference: string; // booking reference
  language?: "en" | "ar";
};

export type ExecutePaymentData = {
  InvoiceId: number;
  IsDirectPayment: boolean;
  PaymentURL: string;
  CustomerReference: string | null;
  UserDefinedField: string | null;
  RecurringId: string | null;
};

export async function executePayment(
  input: ExecutePaymentInput,
): Promise<
  | { ok: true; invoiceId: number; paymentUrl: string }
  | { ok: false; error: string }
> {
  const result = await callMf<ExecutePaymentData>("/v2/ExecutePayment", {
    PaymentMethodId: 2,
    InvoiceValue: input.invoiceAmount,
    CustomerName: input.customerName,
    CustomerEmail: input.customerEmail || undefined,
    CustomerMobile: input.customerMobile || undefined,
    CallBackUrl: input.callbackUrl,
    ErrorUrl: input.errorUrl,
    CustomerReference: input.customerReference,
    Language: (input.language ?? "en").toUpperCase(),
    DisplayCurrencyIso: "KWD",
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    invoiceId: result.data.InvoiceId,
    paymentUrl: result.data.PaymentURL,
  };
}

// ─── GetPaymentStatus ────────────────────────────────────────────────────────
// Used by the customer's success-landing page so we don't have to wait
// for the webhook to know the payment outcome before showing them
// "Booking Confirmed".

export type PaymentStatus =
  | "Paid"
  | "Failed"
  | "Pending"
  | "Cancelled"
  | "Authorized";

export type PaymentStatusData = {
  InvoiceId: number;
  InvoiceStatus: PaymentStatus | string;
  InvoiceReference: string | null;
  CustomerReference: string | null;
  InvoiceDisplayValue: string;
  InvoiceValue: number;
  Comments: string | null;
  CreatedDate: string;
  // InvoiceTransactions is a per-attempt log; we don't usually need it
  // unless we're displaying reasons for failure.
  InvoiceTransactions: Array<{
    TransactionId: string;
    PaymentId: string;
    PaymentGateway: string;
    TransactionStatus: string;
    TransactionStatusCode: string | null;
    Error: string | null;
    ErrorCode: string | null;
  }>;
};

export async function getPaymentStatus(
  invoiceId: number,
): Promise<
  | { ok: true; status: PaymentStatus | string; data: PaymentStatusData }
  | { ok: false; error: string }
> {
  const result = await callMf<PaymentStatusData>("/v2/getPaymentStatus", {
    Key: String(invoiceId),
    KeyType: "InvoiceId",
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    status: result.data.InvoiceStatus as PaymentStatus,
    data: result.data,
  };
}

// ─── MakeRefund ──────────────────────────────────────────────────────────────
// Issues a refund for the original paid amount. Used when admin or
// customer cancels a confirmed (paid) booking.

export type MakeRefundInput = {
  invoiceId: number;
  amount: number;
  comment?: string;
};

export type MakeRefundData = {
  RefundId: number | string;
  RefundStatus: string;
  RefundReference: string | null;
};

export async function makeRefund(
  input: MakeRefundInput,
): Promise<
  | { ok: true; refundId: string; status: string }
  | { ok: false; error: string }
> {
  const result = await callMf<MakeRefundData>("/v2/MakeRefund", {
    Key: String(input.invoiceId),
    KeyType: "InvoiceId",
    RefundChargeOnCustomer: false,
    ServiceChargeOnCustomer: false,
    Amount: input.amount,
    Comment: input.comment ?? "Booking cancellation refund",
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    refundId: String(result.data.RefundId),
    status: result.data.RefundStatus,
  };
}

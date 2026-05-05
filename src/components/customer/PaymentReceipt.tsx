import { CheckCircle2, XCircle } from "lucide-react";
import { formatKuwaitDateTime, formatKwd } from "@/lib/time";
import { getDict } from "@/lib/i18n";

// Receipt block rendered on both the success-confirmation page and the
// payment-result failed page. Surfaces the gateway-level identifiers
// (KNET PaymentId, transaction ID, reference ID) so a customer can
// quote them to support / their bank without us having to dig them up.

export type ReceiptTransaction = {
  paymentId: string | null;
  transactionId: string | null;
  referenceId: string | null;
  gateway: string | null;
  status: string;
  amount: number; // KWD
  paidAt: string; // ISO timestamp
};

export function PaymentReceipt({
  transaction,
  variant,
}: {
  transaction: ReceiptTransaction;
  variant: "success" | "failed";
}) {
  const t = getDict();
  const r = t.receipt;
  const isSuccess = variant === "success";

  return (
    <section
      className={`rounded-2xl border ${
        isSuccess ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"
      } p-4 md:p-5`}
    >
      <header className="mb-3 flex items-center gap-2">
        {isSuccess ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
        ) : (
          <XCircle className="h-5 w-5 text-red-600" aria-hidden />
        )}
        <h2
          className={`text-sm font-semibold ${
            isSuccess ? "text-emerald-900" : "text-red-900"
          }`}
        >
          {r.title}
        </h2>
      </header>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <Row label={r.status}>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              isSuccess
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {transaction.status}
          </span>
        </Row>
        <Row label={r.amount}>
          <span className="font-medium text-slate-900">
            {formatKwd(transaction.amount)}
          </span>
        </Row>
        <Row label={r.datetime}>
          <span dir="ltr">{formatKuwaitDateTime(transaction.paidAt)}</span>
        </Row>
        {transaction.gateway ? (
          <Row label={r.gateway}>
            <span dir="ltr">{transaction.gateway}</span>
          </Row>
        ) : null}
        {transaction.paymentId ? (
          <Row label={r.payment_id} mono>
            <span dir="ltr">{transaction.paymentId}</span>
          </Row>
        ) : null}
        {transaction.transactionId ? (
          <Row label={r.transaction_id} mono>
            <span dir="ltr">{transaction.transactionId}</span>
          </Row>
        ) : null}
        {transaction.referenceId ? (
          <Row label={r.reference_id} mono>
            <span dir="ltr">{transaction.referenceId}</span>
          </Row>
        ) : null}
      </dl>
    </section>
  );
}

function Row({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className={`text-slate-900 ${mono ? "font-mono text-[13px]" : ""}`}>
        {children}
      </dd>
    </div>
  );
}

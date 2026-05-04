import "server-only";

import {
  isTwilioConfigured,
  sendTwilioSms,
  toKuwaitE164,
} from "@/lib/sms/twilio";
import { format } from "@/lib/i18n/shared";
import { getDictByLocale } from "@/lib/i18n/shared";
import type { Locale } from "@/lib/i18n/shared";
import {
  formatKuwaitFullDate,
  formatKuwaitTimeRange,
} from "@/lib/time";

type Args = {
  rawPhone: string;        // whatever's stored on the booking
  customerName: string;
  courtName: string;
  startIso: string;        // slot.start_time
  endIso: string;          // slot.end_time
  reference: string;
  locale: Locale;
};

// Best-effort: we always log the outcome but never throw, so a Twilio
// outage can't take down the booking endpoint. The booking row is the
// source of truth — the SMS is a courtesy.
export async function sendBookingConfirmationSms(args: Args): Promise<void> {
  if (!isTwilioConfigured()) {
    console.warn(
      "[sms] Twilio not configured — skipping booking confirmation",
      { reference: args.reference },
    );
    return;
  }

  const to = toKuwaitE164(args.rawPhone);
  if (!to) {
    console.warn("[sms] Couldn't normalize phone for SMS", {
      reference: args.reference,
    });
    return;
  }

  const t = getDictByLocale(args.locale);
  const date = formatKuwaitFullDate(args.startIso.slice(0, 10));
  const time = formatKuwaitTimeRange(args.startIso, args.endIso);

  const body = format(t.sms.booking_confirmation, {
    name: args.customerName,
    court: args.courtName,
    date,
    time,
    ref: args.reference,
  });

  const result = await sendTwilioSms({ to, body });
  if (!result.ok) {
    console.error("[sms] booking confirmation send failed", {
      reference: args.reference,
      status: result.status,
      error: result.error,
    });
    return;
  }
  console.log("[sms] booking confirmation sent", {
    reference: args.reference,
    sid: result.sid,
  });
}

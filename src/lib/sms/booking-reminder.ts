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
  rawPhone: string;
  customerName: string;
  courtName: string;
  startIso: string;
  endIso: string;
  reference: string;
  locale: Locale;
};

export type ReminderResult =
  | { ok: true; sid: string }
  | { ok: false; error: string };

// Mirrors sendBookingConfirmationSms but uses the reminder template
// and surfaces the result to the cron handler so it can record per-row
// success/failure stats.
export async function sendBookingReminderSms(args: Args): Promise<ReminderResult> {
  if (!isTwilioConfigured()) {
    return { ok: false, error: "twilio_not_configured" };
  }
  const to = toKuwaitE164(args.rawPhone);
  if (!to) {
    return { ok: false, error: "phone_normalize_failed" };
  }

  const t = getDictByLocale(args.locale);
  const date = formatKuwaitFullDate(args.startIso.slice(0, 10));
  const time = formatKuwaitTimeRange(args.startIso, args.endIso);

  const body = format(t.sms.booking_reminder, {
    name: args.customerName,
    court: args.courtName,
    date,
    time,
    ref: args.reference,
  });

  const result = await sendTwilioSms({ to, body });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true, sid: result.sid };
}

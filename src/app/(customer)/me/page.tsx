import Link from "next/link";
import { ArrowLeft, User } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { requireCustomer } from "@/lib/customer";
import { createServerClient } from "@/lib/supabase/server";
import { MyBookingsList } from "@/components/customer/MyBookingsList";
import { CustomerSignOut } from "@/components/customer/CustomerSignOut";
import { SetPasswordForm } from "@/components/customer/SetPasswordForm";
import { PasskeysCard } from "@/components/customer/PasskeysCard";
import { getDict } from "@/lib/i18n";
import type { BookingStatus, Sport } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My account — Smash Courts Kuwait",
  robots: { index: false, follow: false },
};

type Row = {
  id: string;
  reference: string;
  status: BookingStatus;
  total_price: number | string;
  payment_url: string | null;
  refunded_at: string | null;
  court: { id: string; name: string; sport: Sport } | { id: string; name: string; sport: Sport }[] | null;
  slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[] | null;
  reviews: { rating: number; comment: string | null } | { rating: number; comment: string | null }[] | null;
};

async function loadMyBookings(userId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      reference,
      status,
      total_price,
      payment_url,
      refunded_at,
      court:courts(id, name, sport),
      slot:slots(start_time, end_time),
      reviews(rating, comment)
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  const rows = (data ?? []) as Row[];
  return rows.map((r) => {
    const court = Array.isArray(r.court) ? r.court[0] : r.court;
    const slot = Array.isArray(r.slot) ? r.slot[0] : r.slot;
    const review = Array.isArray(r.reviews)
      ? (r.reviews[0] ?? null)
      : r.reviews;
    return {
      id: r.id,
      reference: r.reference,
      status: r.status,
      total_price: Number(r.total_price),
      payment_url: r.payment_url,
      refunded_at: r.refunded_at,
      court: court ? { id: court.id, name: court.name, sport: court.sport } : null,
      slot: slot ? { start_time: slot.start_time, end_time: slot.end_time } : null,
      review: review
        ? { rating: review.rating, comment: review.comment }
        : null,
    };
  });
}

export default async function MyAccountPage() {
  const t = getDict();
  const customer = await requireCustomer();
  const bookings = await loadMyBookings(customer.user_id);

  return (
    <Container className="py-6 md:py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden /> {t.common.home}
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand">
            <User className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">
              {customer.name}
            </h1>
            <p className="mt-0.5 text-sm text-slate-600" dir="ltr">
              {customer.phone}
            </p>
          </div>
        </div>
        <CustomerSignOut />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">
        {t.me.my_bookings}
      </h2>
      <div className="mt-3">
        <MyBookingsList initial={bookings} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">
        {t.me.signin_options}
      </h2>
      <Card className="mt-3">
        <p className="text-sm text-slate-600">{t.me.signin_options_help}</p>
        <div className="mt-4">
          <SetPasswordForm />
        </div>
      </Card>

      <div className="mt-3">
        <PasskeysCard />
      </div>
    </Container>
  );
}

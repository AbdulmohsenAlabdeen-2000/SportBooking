import type { Sport } from "@/lib/types";

// Mirror of the server-side AdminWidget union. -s.ts so client +
// server imports don't drag in `server-only` modules.

export type TodaySummaryWidget = {
  type: "today_summary";
  date: string;
  stats: {
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    revenue_kwd: number;
  };
};

export type TotalRevenueWidget = {
  type: "total_revenue";
  revenue_kwd: number;
};

export type WeekChartWidget = {
  type: "week_chart";
  days: Array<{
    date: string;
    confirmed: number;
    cancelled: number;
    revenue_kwd: number;
  }>;
};

export type BookingListWidget = {
  type: "booking_list";
  title: string;
  bookings: Array<{
    reference: string;
    customer_name: string;
    customer_phone: string;
    court_name: string | null;
    sport: Sport | null;
    start_time: string | null;
    end_time: string | null;
    total_price: number;
    status: string;
  }>;
};

export type BookingDetailWidget = {
  type: "booking_detail";
  reference: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  court_name: string | null;
  sport: Sport | null;
  start_time: string | null;
  end_time: string | null;
  total_price: number;
  status: string;
  payment_invoice_id: string | null;
  paid_at: string | null;
  refund_id: string | null;
  refunded_at: string | null;
  notes: string | null;
};

export type CompletedConfirmationWidget = {
  type: "completed_confirmation";
  reference: string;
  previous_status: string;
};

export type AdminChatWidget =
  | TodaySummaryWidget
  | TotalRevenueWidget
  | WeekChartWidget
  | BookingListWidget
  | BookingDetailWidget
  | CompletedConfirmationWidget;

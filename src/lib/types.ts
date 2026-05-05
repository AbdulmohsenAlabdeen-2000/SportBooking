export type Sport =
  | "padel"
  | "tennis"
  | "football"
  | "squash"
  | "basketball"
  | "volleyball"
  | "cricket"
  | "pickleball"
  | "badminton"
  | "futsal";

export const SPORTS: ReadonlyArray<Sport> = [
  "padel",
  "tennis",
  "football",
  "squash",
  "basketball",
  "volleyball",
  "cricket",
  "pickleball",
  "badminton",
  "futsal",
];

export type SlotStatus = "open" | "closed" | "booked";

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "declined";

export interface Court {
  id: string;
  name: string;
  sport: Sport;
  description: string | null;
  capacity: number;
  price_per_slot: number;
  slot_duration_minutes: number;
  image_url: string | null;
  // Customer-facing /api/courts strips this (only returns active rows);
  // /api/admin/courts includes it so admins can reactivate from the UI.
  is_active?: boolean;
}

export interface Slot {
  id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  status: SlotStatus;
  is_past?: boolean;
}

export interface Booking {
  id: string;
  reference: string;
  court_id: string;
  slot_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  total_price: number;
  status: BookingStatus;
  created_at: string;
}

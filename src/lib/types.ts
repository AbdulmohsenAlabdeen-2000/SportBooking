export type Sport = "padel" | "tennis" | "football";

export type SlotStatus = "open" | "closed" | "booked";

export type BookingStatus = "confirmed" | "completed" | "cancelled";

export interface Court {
  id: string;
  name: string;
  sport: Sport;
  description: string | null;
  capacity: number;
  price_per_slot: number;
  slot_duration_minutes: number;
  image_url: string | null;
}

export interface Slot {
  id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  status: SlotStatus;
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

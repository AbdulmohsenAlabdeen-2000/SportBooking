import type { Sport } from "@/lib/types";

// Mirror of the server-side WidgetPayload union. Kept in a -s.ts file
// so both client and server can import the type without dragging in
// "server-only" modules.

export type CourtPickerWidget = {
  type: "court_picker";
  courts: Array<{
    id: string;
    name: string;
    sport: Sport;
    capacity: number;
    price_per_slot: number;
    image_url: string | null;
    is_popular?: boolean;
    is_new?: boolean;
  }>;
};

export type DatePickerWidget = {
  type: "date_picker";
  court_id: string;
  court_name: string;
  sport: Sport;
  days: Array<{ date: string; open_count: number }>;
};

export type SlotPickerWidget = {
  type: "slot_picker";
  court_id: string;
  court_name: string;
  sport: Sport;
  date: string;
  slots: Array<{
    id: string;
    start_time: string;
    end_time: string;
    status: "open" | "booked" | "closed";
    is_past: boolean;
  }>;
};

export type ConfirmBookingWidget = {
  type: "confirm_booking";
  court_id: string;
  court_name: string;
  sport: Sport;
  slot_id: string;
  start_time: string;
  end_time: string;
  price: number;
};

export type ChatWidget =
  | CourtPickerWidget
  | DatePickerWidget
  | SlotPickerWidget
  | ConfirmBookingWidget;

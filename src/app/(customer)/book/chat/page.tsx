import { ChatBooking } from "@/components/chat-booking/ChatBooking";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Book by chat — Smash Courts Kuwait",
  robots: { index: false, follow: false },
};

export default function ChatBookingPage() {
  return <ChatBooking />;
}

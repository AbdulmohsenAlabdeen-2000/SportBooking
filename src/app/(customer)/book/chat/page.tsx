import { ChatBooking } from "@/components/chat-booking/ChatBooking";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Book by chat — Smash Courts Kuwait",
  robots: { index: false, follow: false },
};

// Standalone full-page entry. The same component also renders inside
// the floating side panel on every customer page; this route is the
// deep-link / share-friendly variant.
export default function ChatBookingPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <ChatBooking />
    </div>
  );
}

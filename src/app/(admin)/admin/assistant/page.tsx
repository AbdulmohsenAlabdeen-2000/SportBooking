import { requireAdmin } from "@/lib/auth";
import { AdminAssistant } from "@/components/admin-chat/AdminAssistant";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Assistant — Smash Courts admin",
  robots: { index: false, follow: false },
};

export default async function AdminAssistantPage() {
  await requireAdmin();
  return <AdminAssistant />;
}

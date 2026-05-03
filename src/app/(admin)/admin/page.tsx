import { requireAdmin } from "@/lib/auth";

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Welcome, <span className="font-medium text-slate-900">{user.email}</span>.
        The full dashboard (today's bookings, summary cards) ships in Session 7.
      </p>
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Placeholder content. Sign-out works, the sidebar / bottom nav work, the
        middleware redirects unauthorized visitors to <code>/admin/login</code>.
      </div>
    </section>
  );
}

import type { ReactNode } from "react";

// Placeholder layout for the (admin) route group. Real auth gating and
// admin chrome (sidebar, breadcrumbs) ship in Sessions 6-9; this exists
// now only so the route group is reserved and customer code can't leak in.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-bg">{children}</div>;
}

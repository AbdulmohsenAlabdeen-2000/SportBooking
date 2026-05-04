"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  LayoutDashboard,
  ClipboardList,
  LandPlot,
} from "lucide-react";

type LinkSpec = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  exact?: boolean;
};

const LINKS: LinkSpec[] = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/admin/bookings", label: "Bookings", Icon: ClipboardList },
  { href: "/admin/slots", label: "Slots", Icon: Calendar },
  { href: "/admin/courts", label: "Courts", Icon: LandPlot },
];

function isActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav
      className="hidden h-[calc(100vh-3.5rem)] w-60 flex-none border-r border-slate-200 bg-slate-50 md:block"
      aria-label="Admin navigation"
    >
      <ul className="space-y-1 p-3">
        {LINKS.map(({ href, label, Icon, exact }) => {
          const active = isActive(pathname, href, exact);
          return (
            <li key={href}>
              <Link
                href={href}
                className={[
                  "flex h-10 items-center gap-3 rounded-lg border-l-4 px-3 text-sm transition-colors",
                  active
                    ? "border-brand bg-white text-slate-900 shadow-sm"
                    : "border-transparent text-slate-600 hover:bg-white hover:text-slate-900",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminBottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white md:hidden"
      aria-label="Admin navigation"
    >
      {LINKS.map(({ href, label, Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            className={[
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              active ? "text-brand" : "text-slate-500",
            ].join(" ")}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

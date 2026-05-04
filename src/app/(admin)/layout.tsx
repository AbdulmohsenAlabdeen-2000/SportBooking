import type { ReactNode } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { AdminSidebar, AdminBottomNav } from "@/components/admin/AdminNav";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ToastProvider } from "@/components/ui/Toast";
import { DemoBanner } from "@/components/DemoBanner";
import { getDict, getLocale } from "@/lib/i18n";

export const metadata = {
  title: "Admin — Smash Courts Kuwait",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAdmin();
  const t = getDict();
  const locale = getLocale();

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg text-slate-900">
        <DemoBanner />
        <header className="sticky top-0 z-20 h-14 border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 font-semibold text-slate-900"
            >
              <Building2 className="h-5 w-5 text-slate-700" aria-hidden />
              <span>
                {t.admin.brand} <span className="text-slate-400">·</span>{" "}
                <span className="text-slate-700">
                  {t.admin.brand_admin_suffix}
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-2 md:gap-3">
              <LanguageToggle current={locale} />
              <span
                className="hidden truncate text-sm text-slate-600 md:inline"
                dir="ltr"
              >
                {user.email}
              </span>
              <SignOutButton />
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-7xl">
          <AdminSidebar />
          <main className="min-w-0 flex-1 px-4 pb-24 pt-4 md:p-8 md:pb-8">
            {children}
          </main>
        </div>

        <AdminBottomNav />
      </div>
    </ToastProvider>
  );
}

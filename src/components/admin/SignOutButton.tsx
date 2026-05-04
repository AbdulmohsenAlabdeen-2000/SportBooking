"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/browser";
import { useDict } from "@/lib/i18n/client";

export function SignOutButton({ className = "" }: { className?: string }) {
  const t = useDict();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={[
        "inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500",
        busy ? "opacity-60" : "",
        className,
      ].join(" ")}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      <span>{busy ? t.admin.signing_out : t.admin.sign_out}</span>
    </button>
  );
}

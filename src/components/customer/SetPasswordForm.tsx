"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { PasswordStrength } from "@/components/ui/PasswordStrength";
import { createBrowserClient } from "@/lib/supabase/browser";
import { useDict } from "@/lib/i18n/client";

export function SetPasswordForm() {
  const t = useDict();
  const { toast } = useToast();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;
    setError(null);
    if (pw.length < 8) {
      setError(t.me.set_password_short);
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserClient();
      const { error: e } = await supabase.auth.updateUser({ password: pw });
      if (e) {
        setError(t.me.set_password_couldnt);
        setBusy(false);
        return;
      }
      toast(t.me.set_password_saved, "success");
      setPw("");
    } catch {
      setError(t.common.network_error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <label className="block">
        <span className="text-sm font-medium text-slate-900">
          {t.me.set_password_label}
        </span>
        <input
          type="password"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={t.me.set_password_placeholder}
          className="mt-1 block h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:ring-2 focus:ring-brand"
        />
        <PasswordStrength password={pw} />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={busy || pw.length < 8}
        className={[
          "inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
          busy || pw.length < 8
            ? "cursor-not-allowed bg-slate-200 text-slate-500"
            : "bg-slate-800 text-white hover:bg-slate-700",
        ].join(" ")}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t.common.saving}
          </>
        ) : (
          t.me.set_password_save
        )}
      </button>
    </form>
  );
}

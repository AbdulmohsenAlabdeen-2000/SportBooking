"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { createBrowserClient } from "@/lib/supabase/browser";

export function SetPasswordForm() {
  const { toast } = useToast();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (busy) return;
    setError(null);
    if (pw.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createBrowserClient();
      const { error: e } = await supabase.auth.updateUser({ password: pw });
      if (e) {
        setError("Couldn't update — try again.");
        setBusy(false);
        return;
      }
      toast("Password saved.", "success");
      setPw("");
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <label className="block">
        <span className="text-sm font-medium text-slate-900">
          Set or change password (optional)
        </span>
        <input
          type="password"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="At least 8 characters"
          className="mt-1 block h-11 w-full rounded-xl border border-slate-300 px-3 text-base outline-none focus:ring-2 focus:ring-brand"
        />
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
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
          </>
        ) : (
          "Save password"
        )}
      </button>
    </form>
  );
}

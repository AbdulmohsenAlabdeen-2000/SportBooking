"use client";

import { useEffect, useState } from "react";
import {
  Fingerprint,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
} from "@simplewebauthn/browser";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useDict } from "@/lib/i18n/client";

type Passkey = {
  id: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
};

export function PasskeysCard() {
  const t = useDict();
  const { toast } = useToast();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [list, setList] = useState<Passkey[] | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported(
      typeof window.PublicKeyCredential !== "undefined" &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ===
          "function",
    );
  }, []);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/auth/passkey/credentials", {
        cache: "no-store",
      });
      if (!res.ok) {
        setList([]);
        return;
      }
      const json = (await res.json()) as { passkeys: Passkey[] };
      setList(json.passkeys);
    } catch {
      setList([]);
    }
  }

  async function enroll() {
    if (enrolling) return;
    setEnrolling(true);
    try {
      const beginRes = await fetch("/api/auth/passkey/register/begin", {
        method: "POST",
      });
      if (!beginRes.ok) {
        const json = (await beginRes.json().catch(() => ({}))) as {
          error?: string;
        };
        if (json.error === "passkey_table_missing") {
          toast(t.passkey.err_table_missing, "error");
        } else {
          toast(t.passkey.err_enroll, "error");
        }
        setEnrolling(false);
        return;
      }
      const options =
        (await beginRes.json()) as PublicKeyCredentialCreationOptionsJSON;
      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON: options });
      } catch (e) {
        // User cancelled the biometric prompt, or the device declined.
        if (
          e instanceof Error &&
          (e.name === "NotAllowedError" || e.name === "AbortError")
        ) {
          setEnrolling(false);
          return;
        }
        toast(t.passkey.err_enroll, "error");
        setEnrolling(false);
        return;
      }
      const finishRes = await fetch("/api/auth/passkey/register/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attResp }),
      });
      if (!finishRes.ok) {
        const json = (await finishRes.json().catch(() => ({}))) as {
          error?: string;
        };
        if (json.error === "passkey_already_registered") {
          toast(t.passkey.err_already_registered, "error");
        } else {
          toast(t.passkey.err_enroll, "error");
        }
        setEnrolling(false);
        return;
      }
      toast(t.passkey.enrolled_success, "success");
      await load();
    } catch {
      toast(t.passkey.err_enroll, "error");
    } finally {
      setEnrolling(false);
    }
  }

  async function rename(id: string, current: string) {
    const next = window.prompt(t.passkey.rename_prompt, current);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === current) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/auth/passkey/credentials/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        toast(t.passkey.err_rename, "error");
      } else {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`${t.passkey.delete_confirm} "${name}"?`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/auth/passkey/credentials/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast(t.passkey.err_delete, "error");
      } else {
        toast(t.passkey.deleted_success, "success");
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  if (supported === false) return null;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand/10 text-brand">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-slate-900">
            {t.passkey.title}
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">{t.passkey.subtitle}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {list === null ? (
          <div className="flex justify-center py-3">
            <Loader2
              className="h-5 w-5 animate-spin text-slate-400"
              aria-hidden
            />
          </div>
        ) : list.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
            {t.passkey.empty}
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Fingerprint
                    className="h-4 w-4 flex-none text-brand"
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium text-slate-900">
                    {p.name}
                  </span>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <button
                    type="button"
                    onClick={() => rename(p.id, p.name)}
                    disabled={busyId === p.id}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    aria-label={t.passkey.rename}
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id, p.name)}
                    disabled={busyId === p.id}
                    className="inline-flex h-8 items-center justify-center rounded-md border border-red-300 bg-white px-2 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                    aria-label={t.passkey.remove}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={enroll}
        disabled={enrolling || supported === null}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:opacity-60 sm:w-auto"
      >
        {enrolling ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
            {t.passkey.enrolling}
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" aria-hidden /> {t.passkey.add}
          </>
        )}
      </button>

      <p className="mt-2 text-xs text-slate-500">{t.passkey.hint}</p>
    </Card>
  );
}

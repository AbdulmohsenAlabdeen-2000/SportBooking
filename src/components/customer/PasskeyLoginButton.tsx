"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Loader2 } from "lucide-react";
import {
  startAuthentication,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { useDict } from "@/lib/i18n/client";

export function PasskeyLoginButton({
  onError,
  next,
}: {
  onError: (msg: string) => void;
  next: string;
}) {
  const t = useDict();
  const router = useRouter();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported(typeof window.PublicKeyCredential !== "undefined");
  }, []);

  async function signIn() {
    if (busy) return;
    setBusy(true);
    onError("");
    try {
      const beginRes = await fetch("/api/auth/passkey/auth/begin", {
        method: "POST",
      });
      if (!beginRes.ok) {
        onError(t.passkey.err_signin);
        setBusy(false);
        return;
      }
      const options =
        (await beginRes.json()) as PublicKeyCredentialRequestOptionsJSON;

      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: options });
      } catch (e) {
        if (
          e instanceof Error &&
          (e.name === "NotAllowedError" || e.name === "AbortError")
        ) {
          // User cancelled — silent.
          setBusy(false);
          return;
        }
        onError(t.passkey.err_signin);
        setBusy(false);
        return;
      }

      const finishRes = await fetch("/api/auth/passkey/auth/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: assertion }),
      });
      if (!finishRes.ok) {
        const json = (await finishRes.json().catch(() => ({}))) as {
          error?: string;
        };
        if (json.error === "credential_not_found") {
          onError(t.passkey.err_unknown_passkey);
        } else if (json.error?.startsWith("session_bridge_failed")) {
          onError(t.passkey.err_session_bridge);
        } else {
          onError(t.passkey.err_signin);
        }
        setBusy(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      onError(t.passkey.err_signin);
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={signIn}
      disabled={busy}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
          {t.common.working}
        </>
      ) : (
        <>
          <Fingerprint className="h-5 w-5 text-brand" aria-hidden />{" "}
          {t.passkey.login_button}
        </>
      )}
    </button>
  );
}

"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { useDict } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/shared";

export function CopyReference({ reference }: { reference: string }) {
  const t = useDict();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — silently no-op; the reference is still on screen.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={format(t.confirmed.copy_aria, { reference })}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-brand" aria-hidden /> {t.confirmed.copied}
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" aria-hidden /> {t.confirmed.copy}
        </>
      )}
    </button>
  );
}

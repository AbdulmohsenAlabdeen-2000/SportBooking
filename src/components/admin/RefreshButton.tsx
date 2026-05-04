"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function handleClick() {
    setBusy(true);
    router.refresh();
    window.setTimeout(() => setBusy(false), 600);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
      aria-label="Refresh dashboard"
    >
      <RefreshCw
        className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}
        aria-hidden
      />
      Refresh
    </button>
  );
}

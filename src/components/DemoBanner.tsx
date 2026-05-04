import { isDemoMode } from "@/lib/demo/mode";

// Tiny strip across the top of every page when Supabase env vars are missing.
// Keeps the rest of the UI honest about the fact that data is in-memory.
export function DemoBanner() {
  if (!isDemoMode()) return null;
  return (
    <div
      role="status"
      className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900"
    >
      <strong className="font-semibold">Demo mode</strong> · in-memory data,
      resets on server restart. Add Supabase keys to <code>.env.local</code> to
      switch to a real database.
    </div>
  );
}

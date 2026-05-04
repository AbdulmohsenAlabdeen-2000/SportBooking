import { isDemoMode } from "@/lib/demo/mode";
import { format, getDict } from "@/lib/i18n";

// Tiny strip across the top of every page when Supabase env vars are missing.
// Keeps the rest of the UI honest about the fact that data is in-memory.
export function DemoBanner() {
  if (!isDemoMode()) return null;
  const t = getDict();
  const rest = format(t.demo.banner_rest, { env: ".env.local" });
  return (
    <div
      role="status"
      className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900"
    >
      <strong className="font-semibold">{t.demo.banner_strong}</strong> · {rest}
    </div>
  );
}

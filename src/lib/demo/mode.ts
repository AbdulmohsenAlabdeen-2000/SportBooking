// Demo mode is active when the Supabase keys are missing. The app falls back
// to an in-memory store so the customer flow is fully usable without any
// external setup. Real Supabase wins whenever the keys are present.
export function isDemoMode(): boolean {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

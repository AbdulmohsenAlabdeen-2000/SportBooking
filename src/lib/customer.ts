import "server-only";
import { redirect } from "next/navigation";
import { createCookieClient } from "@/lib/supabase/route";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/mode";

export type CustomerProfile = {
  user_id: string;
  name: string;
  phone: string;
  created_at: string;
};

// Throws-style auth for customer-scoped Server Components. Redirects to
// /login if the visitor is not signed in, or /signup if they're signed in
// but somehow have no customer row (race condition, or the trigger failed).
export async function requireCustomer(
  redirectTo = "/login",
): Promise<CustomerProfile> {
  if (isDemoMode()) {
    return {
      user_id: "demo-customer",
      name: "Demo Customer",
      phone: "+96594490924",
      created_at: new Date().toISOString(),
    };
  }

  const cookieClient = createCookieClient();
  const { data: userResp } = await cookieClient.auth.getUser();
  const user = userResp.user;
  if (!user) redirect(redirectTo);

  // Use the service-role client to fetch the profile so RLS doesn't get in
  // the way during the Server Component render.
  const supabase = createServerClient();
  const { data: profile, error } = await supabase
    .from("customers")
    .select("user_id, name, phone, created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) redirect(redirectTo);
  if (!profile) {
    // Auth user exists but no customer row — usually means the signup
    // trigger hasn't fired yet, or the user is an admin trying to use
    // customer routes. Send them to signup to complete the profile.
    redirect("/signup");
  }
  return profile as CustomerProfile;
}

// Soft variant — returns null instead of redirecting. Useful for the customer
// header so the layout can branch on signed-in vs anonymous without forcing
// auth on every customer page.
export async function getCurrentCustomer(): Promise<CustomerProfile | null> {
  if (isDemoMode()) return null;
  const cookieClient = createCookieClient();
  const { data: userResp } = await cookieClient.auth.getUser();
  const user = userResp.user;
  if (!user) return null;

  const supabase = createServerClient();
  const { data: profile, error } = await supabase
    .from("customers")
    .select("user_id, name, phone, created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !profile) return null;
  return profile as CustomerProfile;
}

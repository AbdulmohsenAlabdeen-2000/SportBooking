import "server-only";
import { redirect } from "next/navigation";
import { createCookieClient } from "@/lib/supabase/route";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/mode";

export type AdminUser = { id: string; email: string };

const DEMO_ADMIN: AdminUser = {
  id: "demo-admin",
  email: "demo@smashcourts.kw",
};

// Throw-style authorization for Server Components. If the visitor is not an
// admin, redirects to /admin/login. Use in admin Server Components and admin
// API route handlers.
export async function requireAdmin(): Promise<AdminUser> {
  if (isDemoMode()) return DEMO_ADMIN;
  const user = await getCurrentAdmin();
  if (!user) redirect("/admin/login");
  return user;
}

// Soft variant — returns null instead of redirecting. Used by /admin/login
// itself so a logged-in admin can be bounced to /admin.
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  if (isDemoMode()) return DEMO_ADMIN;
  const cookieClient = createCookieClient();
  const { data, error } = await cookieClient.auth.getUser();
  if (error || !data.user || !data.user.email) return null;

  const email = data.user.email.toLowerCase();
  if (!(await isAdminEmail(email))) return null;

  return { id: data.user.id, email };
}

// Service-role lookup against the admin_emails allowlist. Service role bypasses
// RLS, which is intentional — we never expose this table to the anon role.
export async function isAdminEmail(email: string): Promise<boolean> {
  if (isDemoMode()) return true;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (error) return false;
  return !!data;
}

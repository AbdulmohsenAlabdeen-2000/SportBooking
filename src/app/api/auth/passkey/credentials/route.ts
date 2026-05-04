import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { createCookieClient } from "@/lib/supabase/route";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/auth/passkey/credentials — list current customer's passkeys
export async function GET() {
  const cookieClient = createCookieClient();
  const { data: userResp } = await cookieClient.auth.getUser();
  const user = userResp.user;
  if (!user) return jsonError("not_signed_in", 401);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("passkey_credentials")
    .select("id, name, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    if (error.message.toLowerCase().includes("does not exist")) {
      return NextResponse.json({ passkeys: [] });
    }
    return jsonError(error.message, 500);
  }
  return NextResponse.json({ passkeys: data ?? [] });
}

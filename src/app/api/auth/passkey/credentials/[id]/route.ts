import { NextResponse } from "next/server";
import { jsonError, isUuid } from "@/lib/api";
import { createCookieClient } from "@/lib/supabase/route";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// PATCH — rename a passkey
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) return jsonError("invalid_id", 400);

  const cookieClient = createCookieClient();
  const { data: userResp } = await cookieClient.auth.getUser();
  const user = userResp.user;
  if (!user) return jsonError("not_signed_in", 401);

  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    return jsonError("invalid_json", 400);
  }

  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) return jsonError("name_required", 400);

  const supabase = createServerClient();
  const { error } = await supabase
    .from("passkey_credentials")
    .update({ name })
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}

// DELETE — remove a passkey
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) return jsonError("invalid_id", 400);

  const cookieClient = createCookieClient();
  const { data: userResp } = await cookieClient.auth.getUser();
  const user = userResp.user;
  if (!user) return jsonError("not_signed_in", 401);

  const supabase = createServerClient();
  const { error } = await supabase
    .from("passkey_credentials")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}

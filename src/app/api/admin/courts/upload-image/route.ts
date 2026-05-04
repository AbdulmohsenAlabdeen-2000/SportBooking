import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BUCKET = "court-images";

function extFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(req: Request) {
  await requireAdmin();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("invalid_form", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("file_required", 400);
  if (file.size === 0) return jsonError("file_empty", 400);
  if (file.size > MAX_BYTES) return jsonError("file_too_large", 413);
  if (!ALLOWED_TYPES.has(file.type)) return jsonError("invalid_type", 415);

  const path = `${randomUUID()}.${extFor(file.type)}`;

  const supabase = createServerClient();
  const buf = await file.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, {
      contentType: file.type,
      cacheControl: "31536000",
    });

  if (upErr) {
    if (upErr.message.toLowerCase().includes("bucket not found")) {
      return jsonError("bucket_missing", 500);
    }
    return jsonError(upErr.message, 500);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path }, { status: 201 });
}

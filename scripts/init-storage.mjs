// One-off bucket bootstrap. Idempotent — safe to re-run.
//
//   node --env-file=.env.local scripts/init-storage.mjs
//
// Mirrors what supabase/migrations/006_court_images.sql does, but
// goes through the Storage admin API so it works without the
// Supabase CLI.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "court-images";
const OPTIONS = {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
};

const { data: existing } = await supabase.storage.getBucket(BUCKET);

if (existing) {
  console.log(`Bucket "${BUCKET}" already exists — updating settings.`);
  const { error } = await supabase.storage.updateBucket(BUCKET, OPTIONS);
  if (error) {
    console.error("updateBucket failed:", error.message);
    process.exit(1);
  }
} else {
  const { error } = await supabase.storage.createBucket(BUCKET, OPTIONS);
  if (error) {
    console.error("createBucket failed:", error.message);
    process.exit(1);
  }
  console.log(`Created bucket "${BUCKET}".`);
}

const { data: confirm } = await supabase.storage.getBucket(BUCKET);
console.log("Bucket settings:", {
  id: confirm?.id,
  public: confirm?.public,
  file_size_limit: confirm?.file_size_limit,
  allowed_mime_types: confirm?.allowed_mime_types,
});

-- 006_court_images.sql
-- Public Supabase Storage bucket for admin-uploaded court photos.
--
-- Public read so the URLs Supabase hands back work for customers
-- without signed-URL roundtrips. Writes happen only via the admin
-- upload route, which uses the service-role key and bypasses RLS —
-- so no per-action policies are needed beyond the implicit public
-- read that comes with `public = true`.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'court-images',
  'court-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

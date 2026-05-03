-- Smash Courts Kuwait — admin allowlist (Session 06)
-- A small allowlist table that gates /admin/* in addition to Supabase Auth.
-- Even if a user signs up in Auth, they can't reach /admin unless their
-- email is in this table.
--
-- Run in the Supabase SQL editor after 001_init.sql.

create table if not exists public.admin_emails (
  email      text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_emails enable row level security;
-- No policies = no public access. Server reads via the service-role key.

-- Seed your first admin (replace with the email of the user you created in
-- Supabase Auth → Users):
--
--   insert into public.admin_emails (email) values ('ahmed@smashcourts.kw')
--   on conflict (email) do nothing;

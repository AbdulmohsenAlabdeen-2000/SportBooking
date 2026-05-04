-- 007_passkeys.sql
-- WebAuthn / passkey credentials. One row per registered authenticator.
-- A user can have many passkeys (phone, laptop, security key) and use
-- any of them to sign in. The credential_id is the public identifier
-- the browser hands us; the public_key is what we verify signatures
-- against on subsequent logins.
--
-- Counter is the signature counter the authenticator returns; we
-- store it to detect cloned credentials. Some platform authenticators
-- (Apple, Google) always return 0 — that's expected.

create table if not exists passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Base64URL-encoded credential ID (raw bytes from the authenticator).
  credential_id text not null unique,
  -- COSE-encoded public key, base64url.
  public_key text not null,
  -- Last-seen signature counter.
  counter bigint not null default 0,
  -- Transports the authenticator advertised — usable as a hint to the
  -- browser on subsequent auth (e.g. ['internal', 'hybrid']).
  transports text[] not null default '{}',
  -- User-friendly name so the customer can tell their iPhone apart from
  -- their MacBook. Defaults to a stub on insert; rename via /me.
  name text not null default 'Passkey',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists passkey_credentials_user_id_idx
  on passkey_credentials (user_id);

alter table passkey_credentials enable row level security;

-- Customers can read/insert/update/delete their own passkeys.
-- (Inserts go through the API which uses the service role anyway, but
-- having policies in place means the table is safe even if a future
-- route uses the cookie client by mistake.)

create policy "passkeys_select_own"
  on passkey_credentials for select
  using (user_id = auth.uid());

create policy "passkeys_insert_own"
  on passkey_credentials for insert
  with check (user_id = auth.uid());

create policy "passkeys_update_own"
  on passkey_credentials for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "passkeys_delete_own"
  on passkey_credentials for delete
  using (user_id = auth.uid());

-- Spark QR — GHL marketplace app: SSO location + OAuth install.
--
-- The robust way to know which GHL location is viewing the panel is the app's
-- SSO: the custom page asks GHL for the signed user session and the backend
-- decrypts it (Shared Secret) to the current activeLocation. This removes the
-- dependency on {{location.id}} in a plain menu link (which wasn't substituting)
-- and makes the location un-spoofable.
--
-- Credentials live in qr.app_config (not in git). Set them out-of-band, e.g.:
--   update qr.app_config set
--     ghl_client_id = '<client id>',
--     ghl_client_secret = '<client secret>',
--     ghl_sso_key = '<shared secret / SSO key>';

alter table qr.app_config
  add column if not exists ghl_client_id text not null default '',
  add column if not exists ghl_client_secret text not null default '',
  add column if not exists ghl_sso_key text not null default '';

-- SSO shared secret, read only by the spark-qr-admin edge function to decrypt.
create or replace function public.spark_qr_sso_key()
returns text language sql security definer set search_path=public, qr as $$
  select ghl_sso_key from qr.app_config limit 1;
$$;
revoke all on function public.spark_qr_sso_key() from anon, authenticated;

-- App client credentials, for the OAuth code→token exchange in ghl-oauth-callback.
create or replace function public.qr_ghl_app()
returns json language sql security definer set search_path=public, qr as $$
  select json_build_object('client_id', ghl_client_id, 'client_secret', ghl_client_secret)
  from qr.app_config limit 1;
$$;
revoke all on function public.qr_ghl_app() from anon, authenticated;

-- Per-install OAuth tokens (one row per location). Not required by SSO itself,
-- but lets the app install cleanly and enables future GHL API calls per account.
create table if not exists qr.ghl_oauth (
  location_id text primary key,
  company_id text not null default '',
  user_type text not null default '',
  access_token text not null default '',
  refresh_token text not null default '',
  expires_at timestamptz,
  scope text not null default '',
  raw jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.qr_ghl_oauth_upsert(
  p_location_id text, p_company_id text, p_user_type text,
  p_access_token text, p_refresh_token text, p_expires_at timestamptz, p_scope text, p_raw jsonb)
returns void language sql security definer set search_path=public, qr as $$
  insert into qr.ghl_oauth (location_id, company_id, user_type, access_token, refresh_token, expires_at, scope, raw, updated_at)
  values (coalesce(p_location_id,''), coalesce(p_company_id,''), coalesce(p_user_type,''),
          coalesce(p_access_token,''), coalesce(p_refresh_token,''), p_expires_at, coalesce(p_scope,''), p_raw, now())
  on conflict (location_id) do update set
    company_id=excluded.company_id, user_type=excluded.user_type,
    access_token=excluded.access_token, refresh_token=excluded.refresh_token,
    expires_at=excluded.expires_at, scope=excluded.scope, raw=excluded.raw, updated_at=now();
$$;
revoke all on function public.qr_ghl_oauth_upsert(text,text,text,text,text,timestamptz,text,jsonb) from anon, authenticated;

-- GHL purge-inbound — keep only manual/form contacts; delete inbound-created ones.
-- Config + audit log for the ghl-purge-inbound edge function. Single-row config,
-- tunable from SQL. Dry-run is ON by default.

create schema if not exists ghl;

create table if not exists ghl.purge_config (
  id           boolean primary key default true check (id),
  location_id  text not null default '',
  pit_token    text not null default '',
  purge_secret text not null,
  dry_run      boolean not null default true,
  max_age_sec  int not null default 300,
  keep_tags    text[] not null default '{keep,manual,form}',
  updated_at   timestamptz not null default now()
);

insert into ghl.purge_config (id, location_id, purge_secret)
values (
  true,
  'jIqId5fQTEscL0KB2neG',
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
on conflict (id) do nothing;

create table if not exists ghl.purge_log (
  id          uuid primary key default gen_random_uuid(),
  contact_id  text,
  action      text,   -- kept | would_delete | deleted | delete_failed
  reason      text,
  source      text,
  channel     text,
  dry_run     boolean,
  created_at  timestamptz not null default now()
);
create index if not exists purge_log_created_idx on ghl.purge_log (created_at desc);

create or replace function public.ghl_purge_config()
returns json
language sql
security definer
set search_path = public, ghl
as $$
  select json_build_object(
    'location_id', location_id,
    'pit_token', pit_token,
    'purge_secret', purge_secret,
    'dry_run', dry_run,
    'max_age_sec', max_age_sec,
    'keep_tags', keep_tags
  ) from ghl.purge_config limit 1;
$$;

create or replace function public.ghl_purge_log(
  p_contact_id text, p_action text, p_reason text,
  p_source text, p_channel text, p_dry_run boolean
)
returns void
language sql
security definer
set search_path = public, ghl
as $$
  insert into ghl.purge_log (contact_id, action, reason, source, channel, dry_run)
  values (p_contact_id, p_action, p_reason, p_source, p_channel, p_dry_run);
$$;

revoke all on function public.ghl_purge_config() from anon, authenticated;
revoke all on function public.ghl_purge_log(text, text, text, text, text, boolean) from anon, authenticated;

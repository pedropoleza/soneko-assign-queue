-- Intelligent purge: decide by the presence of an inbound CHANNEL CONVERSATION
-- (not by source), and run it from a pg_cron scan so no GHL workflow is needed.
-- Manual ("New") and imported contacts have no conversation at creation → kept.

alter table ghl.purge_config
  add column if not exists purge_channel_types text[] not null
  default '{phone,sms,whatsapp,fb,messenger,ig,instagram,facebook,gmb,live_chat,call}';

alter table ghl.purge_config
  add column if not exists scan_window_sec int not null default 1800;

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
    'keep_tags', keep_tags,
    'purge_source_patterns', purge_source_patterns,
    'purge_channel_types', purge_channel_types,
    'scan_window_sec', scan_window_sec
  ) from ghl.purge_config limit 1;
$$;

-- Dedupe guard for the scan loop.
create or replace function public.ghl_purge_already(p_contact_id text)
returns boolean
language sql
security definer
set search_path = public, ghl
as $$
  select exists (
    select 1 from ghl.purge_log
    where contact_id = p_contact_id
      and action in ('deleted', 'kept', 'would_delete')
  );
$$;

revoke all on function public.ghl_purge_config() from anon, authenticated;
revoke all on function public.ghl_purge_already(text) from anon, authenticated;

-- ── pg_cron: scan every 5 minutes (reads the secret from the config row) ──────
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('ghl-purge-scan')
where exists (select 1 from cron.job where jobname = 'ghl-purge-scan');

select cron.schedule(
  'ghl-purge-scan',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/ghl-purge-inbound',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-purge-secret', (select purge_secret from ghl.purge_config limit 1)
    ),
    body := '{"mode":"scan"}'::jsonb
  );
  $job$
);

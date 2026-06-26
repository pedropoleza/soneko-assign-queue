-- Safe-by-default discrimination: only delete contacts whose source matches a
-- configured inbound-channel pattern. Everything else is kept.

alter table ghl.purge_config
  add column if not exists purge_source_patterns text[] not null
  default '{whatsapp,instagram,facebook,messenger,sms,fb,ig}';

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
    'purge_source_patterns', purge_source_patterns
  ) from ghl.purge_config limit 1;
$$;

revoke all on function public.ghl_purge_config() from anon, authenticated;

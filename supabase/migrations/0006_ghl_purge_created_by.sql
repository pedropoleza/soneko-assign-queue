-- Primary discriminator = GHL's native createdBy.source.
-- Channel-auto-created contacts are "INTEGRATION"; "New" = "MANUAL",
-- import = "BULK_ACTION", form = "FORM". Delete ONLY createdBy.source in the
-- delete-list, so manual/import/form are always kept. A blocked-channel
-- conversation is required as confirmation (guards non-messaging integrations).

alter table ghl.purge_config
  add column if not exists purge_created_by_sources text[] not null default '{INTEGRATION}';

alter table ghl.purge_config
  add column if not exists require_channel_conversation boolean not null default true;

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
    'purge_channel_types', purge_channel_types,
    'scan_window_sec', scan_window_sec,
    'purge_created_by_sources', purge_created_by_sources,
    'require_channel_conversation', require_channel_conversation
  ) from ghl.purge_config limit 1;
$$;

revoke all on function public.ghl_purge_config() from anon, authenticated;

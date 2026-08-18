-- Smart Tags — RPCs consumidas pelas edge functions.
-- Todas SECURITY DEFINER e executáveis apenas por service_role: a autenticação
-- (admin secret / webhook secret) é feita na edge function, antes de chamar aqui.

-- ---------------------------------------------------------------------------
-- Admin secret
-- ---------------------------------------------------------------------------
create or replace function public.smarttags_admin_check(p_secret text)
returns boolean
language sql
security definer
set search_path = public, smarttags
as $$
  select coalesce(length(p_secret), 0) >= 24
     and exists (
       select 1 from smarttags.app_config
        where key = 'admin_secret' and value = p_secret
     );
$$;

-- ---------------------------------------------------------------------------
-- Contas
-- ---------------------------------------------------------------------------
create or replace function public.smarttags_account_by_location(p_location_id text)
returns jsonb
language sql
security definer
set search_path = public, smarttags
as $$
  select to_jsonb(a) from smarttags.accounts a
   where a.ghl_location_id = p_location_id;
$$;

create or replace function public.smarttags_list_accounts(p_only_active boolean default true)
returns jsonb
language sql
security definer
set search_path = public, smarttags
as $$
  select coalesce(jsonb_agg(to_jsonb(a) order by a.installed_at), '[]'::jsonb)
    from smarttags.accounts a
   where (not p_only_active) or a.active;
$$;

create or replace function public.smarttags_upsert_account(
  p_location_id     text,
  p_pit_token       text default null,
  p_name            text default null,
  p_field_name      text default null,
  p_field_data_type text default null,
  p_sync_options    boolean default null,
  p_sync_values     boolean default null,
  p_prune_options   boolean default null,
  p_ignore_prefixes text[] default null,
  p_active          boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, smarttags
as $$
declare
  v_row smarttags.accounts;
begin
  insert into smarttags.accounts as a (
    ghl_location_id, pit_token, name, field_name, field_data_type,
    sync_options, sync_values, prune_options, ignore_prefixes, active
  )
  values (
    p_location_id,
    coalesce(p_pit_token, ''),
    p_name,
    coalesce(p_field_name, 'Smart Tags'),
    coalesce(p_field_data_type, 'MULTIPLE_OPTIONS'),
    coalesce(p_sync_options, true),
    coalesce(p_sync_values, true),
    coalesce(p_prune_options, false),
    coalesce(p_ignore_prefixes, '{}'),
    coalesce(p_active, true)
  )
  on conflict (ghl_location_id) do update set
    pit_token       = coalesce(nullif(p_pit_token, ''), a.pit_token),
    name            = coalesce(p_name, a.name),
    field_name      = coalesce(p_field_name, a.field_name),
    field_data_type = coalesce(p_field_data_type, a.field_data_type),
    sync_options    = coalesce(p_sync_options, a.sync_options),
    sync_values     = coalesce(p_sync_values, a.sync_values),
    prune_options   = coalesce(p_prune_options, a.prune_options),
    ignore_prefixes = coalesce(p_ignore_prefixes, a.ignore_prefixes),
    active          = coalesce(p_active, a.active),
    updated_at      = now()
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

create or replace function public.smarttags_set_field(
  p_account_id uuid,
  p_field_id   text,
  p_field_key  text,
  p_field_name text default null
)
returns void
language sql
security definer
set search_path = public, smarttags
as $$
  update smarttags.accounts
     set field_id   = p_field_id,
         field_key  = p_field_key,
         field_name = coalesce(p_field_name, field_name),
         updated_at = now()
   where id = p_account_id;
$$;

create or replace function public.smarttags_touch_sync(p_account_id uuid, p_status text)
returns void
language sql
security definer
set search_path = public, smarttags
as $$
  update smarttags.accounts
     set last_sync_at = now(), last_sync_status = p_status, updated_at = now()
   where id = p_account_id;
$$;

-- ---------------------------------------------------------------------------
-- Tags
-- p_tags: [{"name": "...", "id": "..."}]  (id opcional)
-- Retorna {"new": [...], "seen": n, "total": n}
-- ---------------------------------------------------------------------------
create or replace function public.smarttags_record_tags(
  p_account_id   uuid,
  p_tags         jsonb,
  p_source       text default 'poll',
  p_mark_missing boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, smarttags
as $$
declare
  v_new   text[] := '{}';
  v_seen  integer := 0;
  v_total integer := 0;
begin
  with input as (
    select lower(btrim(t->>'name')) as name_key,
           min(btrim(t->>'name'))   as name,
           array_remove(array_agg(distinct nullif(t->>'id', '')), null) as ids
      from jsonb_array_elements(coalesce(p_tags, '[]'::jsonb)) t
     where btrim(coalesce(t->>'name', '')) <> ''
     group by 1
  ), upserted as (
    insert into smarttags.tags as tg (account_id, name, ghl_tag_ids, source)
    select p_account_id, i.name, i.ids, p_source from input i
    on conflict (account_id, name_key) do update set
      last_seen_at  = now(),
      ghl_tag_ids   = case
                        when p_source = 'poll' then excluded.ghl_tag_ids
                        else tg.ghl_tag_ids
                      end,
      missing_since = null
    returning (xmax = 0) as inserted, tg.name
  )
  select coalesce(array_agg(name order by name) filter (where inserted), '{}'),
         (select count(*) from input)
    into v_new, v_seen
    from upserted;

  -- Marca como sumida toda tag da conta que não veio na leitura completa do GHL.
  -- Só faz sentido quando a lista recebida não está vazia.
  if p_mark_missing and jsonb_array_length(coalesce(p_tags, '[]'::jsonb)) > 0 then
    update smarttags.tags tg
       set missing_since = now()
     where tg.account_id = p_account_id
       and tg.missing_since is null
       and tg.name_key not in (
         select lower(btrim(t->>'name'))
           from jsonb_array_elements(p_tags) t
          where btrim(coalesce(t->>'name', '')) <> ''
       );
  end if;

  select count(*) into v_total from smarttags.tags where account_id = p_account_id;

  return jsonb_build_object('new', to_jsonb(v_new), 'seen', v_seen, 'total', v_total);
end;
$$;

create or replace function public.smarttags_mark_options(p_account_id uuid, p_names text[])
returns void
language sql
security definer
set search_path = public, smarttags
as $$
  update smarttags.tags
     set is_option = true, option_synced_at = now()
   where account_id = p_account_id
     and name_key in (select lower(btrim(n)) from unnest(coalesce(p_names, '{}')) n);
$$;

create or replace function public.smarttags_pending_options(p_account_id uuid)
returns jsonb
language sql
security definer
set search_path = public, smarttags
as $$
  select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
    from smarttags.tags
   where account_id = p_account_id and not is_option and missing_since is null;
$$;

-- ---------------------------------------------------------------------------
-- Runs
-- ---------------------------------------------------------------------------
create or replace function public.smarttags_start_run(p_account_id uuid, p_trigger text)
returns uuid
language sql
security definer
set search_path = public, smarttags
as $$
  insert into smarttags.sync_runs (account_id, trigger) values (p_account_id, p_trigger)
  returning id;
$$;

create or replace function public.smarttags_finish_run(
  p_run_id uuid,
  p_status text,
  p_stats  jsonb default '{}'::jsonb,
  p_error  text default null
)
returns void
language sql
security definer
set search_path = public, smarttags
as $$
  update smarttags.sync_runs
     set status                = p_status,
         tags_seen             = coalesce((p_stats->>'tags_seen')::int, tags_seen),
         tags_new              = coalesce((p_stats->>'tags_new')::int, tags_new),
         options_before        = coalesce((p_stats->>'options_before')::int, options_before),
         options_after         = coalesce((p_stats->>'options_after')::int, options_after),
         options_added         = coalesce(
                                   (select array_agg(value::text)
                                      from jsonb_array_elements_text(p_stats->'options_added') value),
                                   options_added),
         options_removed       = coalesce(
                                   (select array_agg(value::text)
                                      from jsonb_array_elements_text(p_stats->'options_removed') value),
                                   options_removed),
         opportunities_updated = coalesce((p_stats->>'opportunities_updated')::int, opportunities_updated),
         details               = coalesce(p_stats->'details', details),
         error                 = p_error,
         finished_at           = now()
   where id = p_run_id;
$$;

-- ---------------------------------------------------------------------------
-- Eventos de webhook
-- ---------------------------------------------------------------------------
create or replace function public.smarttags_log_event(
  p_account_id  uuid,
  p_location_id text,
  p_event_type  text,
  p_contact_id  text,
  p_payload     jsonb
)
returns uuid
language sql
security definer
set search_path = public, smarttags
as $$
  insert into smarttags.events (account_id, ghl_location_id, event_type, contact_id, payload)
  values (p_account_id, p_location_id, p_event_type, p_contact_id, coalesce(p_payload, '{}'::jsonb))
  returning id;
$$;

create or replace function public.smarttags_finish_event(
  p_event_id uuid,
  p_status   text,
  p_tags_new text[] default '{}',
  p_opps     integer default 0,
  p_error    text default null
)
returns void
language sql
security definer
set search_path = public, smarttags
as $$
  update smarttags.events
     set status                = p_status,
         tags_new              = coalesce(p_tags_new, '{}'),
         opportunities_updated = coalesce(p_opps, 0),
         error                 = p_error,
         processed_at          = now()
   where id = p_event_id;
$$;

-- ---------------------------------------------------------------------------
-- Status (sem expor o PIT token)
-- ---------------------------------------------------------------------------
create or replace function public.smarttags_status(p_location_id text)
returns jsonb
language sql
security definer
set search_path = public, smarttags
as $$
  select jsonb_build_object(
    'account', (
      select to_jsonb(a) - 'pit_token'
        from smarttags.accounts a where a.ghl_location_id = p_location_id
    ),
    'tags', (
      select jsonb_build_object(
               'total',    count(*),
               'options',  count(*) filter (where is_option),
               'pending',  count(*) filter (where not is_option and missing_since is null),
               'missing',  count(*) filter (where missing_since is not null)
             )
        from smarttags.tags t
        join smarttags.accounts a on a.id = t.account_id
       where a.ghl_location_id = p_location_id
    ),
    'runs', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.started_at desc), '[]'::jsonb)
        from (
          select r.* from smarttags.sync_runs r
            join smarttags.accounts a on a.id = r.account_id
           where a.ghl_location_id = p_location_id
           order by r.started_at desc limit 10
        ) r
    ),
    'events', (
      select coalesce(jsonb_agg(to_jsonb(e) - 'payload' order by e.received_at desc), '[]'::jsonb)
        from (
          select e.* from smarttags.events e
            join smarttags.accounts a on a.id = e.account_id
           where a.ghl_location_id = p_location_id
           order by e.received_at desc limit 10
        ) e
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Permissões: nada de anon/authenticated
-- ---------------------------------------------------------------------------
do $$
declare fn text;
begin
  for fn in
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'smarttags\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

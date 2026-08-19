-- IG Opportunities — RPCs consumidas pela edge function.
-- SECURITY DEFINER, executáveis só por service_role. Auth (admin secret) é feita
-- na edge function antes de chamar aqui.

create or replace function public.igopps_admin_check(p_secret text)
returns boolean
language sql
security definer
set search_path = public, igopps
as $$
  select coalesce(length(p_secret), 0) >= 24
     and exists (select 1 from igopps.app_config where key = 'admin_secret' and value = p_secret);
$$;

create or replace function public.igopps_list_accounts(p_only_enabled boolean default true)
returns jsonb
language sql
security definer
set search_path = public, igopps
as $$
  select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb)
    from igopps.accounts a
   where (not p_only_enabled) or a.enabled;
$$;

create or replace function public.igopps_account_by_location(p_location_id text)
returns jsonb
language sql
security definer
set search_path = public, igopps
as $$
  select to_jsonb(a) from igopps.accounts a where a.ghl_location_id = p_location_id;
$$;

create or replace function public.igopps_upsert_account(
  p_location_id      text,
  p_pit_token        text default null,
  p_name             text default null,
  p_pipeline_id      text default null,
  p_stage_id         text default null,
  p_opportunity_source text default null,
  p_name_template    text default null,
  p_require_inbound  boolean default null,
  p_only_after       timestamptz default null,
  p_enabled          boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, igopps
as $$
declare v_row igopps.accounts;
begin
  insert into igopps.accounts as a (
    ghl_location_id, pit_token, name, pipeline_id, stage_id,
    opportunity_source, name_template, require_inbound, only_after, enabled
  )
  values (
    p_location_id, coalesce(p_pit_token, ''), p_name,
    coalesce(p_pipeline_id, ''), coalesce(p_stage_id, ''),
    coalesce(p_opportunity_source, 'instagram'),
    coalesce(p_name_template, '{name}'),
    coalesce(p_require_inbound, false),
    coalesce(p_only_after, now()),
    coalesce(p_enabled, true)
  )
  on conflict (ghl_location_id) do update set
    pit_token          = coalesce(nullif(p_pit_token, ''), a.pit_token),
    name               = coalesce(p_name, a.name),
    pipeline_id        = coalesce(nullif(p_pipeline_id, ''), a.pipeline_id),
    stage_id           = coalesce(nullif(p_stage_id, ''), a.stage_id),
    opportunity_source = coalesce(p_opportunity_source, a.opportunity_source),
    name_template      = coalesce(p_name_template, a.name_template),
    require_inbound    = coalesce(p_require_inbound, a.require_inbound),
    only_after         = coalesce(p_only_after, a.only_after),
    enabled            = coalesce(p_enabled, a.enabled),
    updated_at         = now()
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.igopps_set_cursor(p_account_id uuid, p_cursor_ms bigint)
returns void
language sql
security definer
set search_path = public, igopps
as $$
  update igopps.accounts set cursor_ms = greatest(cursor_ms, p_cursor_ms), updated_at = now()
   where id = p_account_id;
$$;

create or replace function public.igopps_touch_run(p_account_id uuid, p_status text)
returns void
language sql
security definer
set search_path = public, igopps
as $$
  update igopps.accounts set last_run_at = now(), last_run_status = p_status, updated_at = now()
   where id = p_account_id;
$$;

-- Reserva o contato (dedup atômico). Retorna true se ESTA chamada reservou;
-- false se já existia (outro run/contato já processado) — nunca cria duas vezes.
create or replace function public.igopps_claim_contact(
  p_account_id uuid,
  p_contact_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, igopps
as $$
declare v_inserted boolean;
begin
  insert into igopps.created (account_id, ghl_contact_id, outcome)
  values (p_account_id, p_contact_id, 'created')
  on conflict (account_id, ghl_contact_id) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted;  -- 1 linha inserida -> reservou; 0 -> já existia
end;
$$;

-- Preenche os dados após criar (ou marca como 'existing' quando já havia opp).
create or replace function public.igopps_record_result(
  p_account_id     uuid,
  p_contact_id     text,
  p_conversation_id text,
  p_contact_name   text,
  p_ig_handle      text,
  p_opportunity_id text,
  p_outcome        text
)
returns void
language sql
security definer
set search_path = public, igopps
as $$
  update igopps.created set
    conversation_id = coalesce(p_conversation_id, conversation_id),
    contact_name    = coalesce(p_contact_name, contact_name),
    ig_handle       = coalesce(p_ig_handle, ig_handle),
    opportunity_id  = coalesce(p_opportunity_id, opportunity_id),
    outcome         = coalesce(p_outcome, outcome)
   where account_id = p_account_id and ghl_contact_id = p_contact_id;
$$;

-- Libera a reserva quando a criação falhou, para tentar de novo no próximo run.
create or replace function public.igopps_release_contact(p_account_id uuid, p_contact_id text)
returns void
language sql
security definer
set search_path = public, igopps
as $$
  delete from igopps.created
   where account_id = p_account_id and ghl_contact_id = p_contact_id
     and opportunity_id is null;
$$;

create or replace function public.igopps_start_run(p_account_id uuid, p_trigger text, p_cursor bigint)
returns uuid
language sql
security definer
set search_path = public, igopps
as $$
  insert into igopps.runs (account_id, trigger, cursor_before) values (p_account_id, p_trigger, p_cursor)
  returning id;
$$;

create or replace function public.igopps_finish_run(
  p_run_id uuid,
  p_status text,
  p_stats  jsonb default '{}'::jsonb,
  p_error  text default null
)
returns void
language sql
security definer
set search_path = public, igopps
as $$
  update igopps.runs set
    status         = p_status,
    conversations  = coalesce((p_stats->>'conversations')::int, conversations),
    created_count  = coalesce((p_stats->>'created')::int, created_count),
    existing_count = coalesce((p_stats->>'existing')::int, existing_count),
    skipped_count  = coalesce((p_stats->>'skipped')::int, skipped_count),
    cursor_after   = coalesce((p_stats->>'cursor_after')::bigint, cursor_after),
    details        = coalesce(p_stats->'details', details),
    error          = p_error,
    finished_at    = now()
   where id = p_run_id;
$$;

create or replace function public.igopps_status(p_location_id text)
returns jsonb
language sql
security definer
set search_path = public, igopps
as $$
  select jsonb_build_object(
    'account', (select to_jsonb(a) - 'pit_token' from igopps.accounts a where a.ghl_location_id = p_location_id),
    'stats', (
      select jsonb_build_object(
               'total',    count(*),
               'created',  count(*) filter (where outcome = 'created'),
               'existing', count(*) filter (where outcome = 'existing')
             )
        from igopps.created c
        join igopps.accounts a on a.id = c.account_id
       where a.ghl_location_id = p_location_id
    ),
    'runs', (
      select coalesce(jsonb_agg(to_jsonb(r) order by r.started_at desc), '[]'::jsonb)
        from (
          select r.* from igopps.runs r
            join igopps.accounts a on a.id = r.account_id
           where a.ghl_location_id = p_location_id
           order by r.started_at desc limit 10
        ) r
    )
  );
$$;

do $$
declare fn text;
begin
  for fn in
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'igopps\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;

-- Spark QR — multi-location (multi-tenant per GHL account).
--
-- The GHL custom menu link carries {{location.id}}, so each account opens the
-- panel scoped to its own QR codes. We add qr.qr_codes.location_id and thread a
-- p_location_id argument through every admin RPC; queries filter on it so a
-- location can only see / mutate its own rows. Empty string ('') = the main
-- panel (existing QRs, created before this change, keep location_id = '').
--
-- Slugs stay GLOBAL (redirect resolves a slug regardless of location), so
-- spark_qr_check_slug is unchanged.

-- 1. Column + index. Existing rows default to '' (the main panel).
alter table qr.qr_codes
  add column if not exists location_id text not null default '';

create index if not exists qr_codes_location_idx on qr.qr_codes (location_id);

-- 2. Drop the old single-tenant signatures (return type / arg list changes).
drop function if exists public.spark_qr_list(text);
drop function if exists public.spark_qr_get(text, uuid);
drop function if exists public.spark_qr_create(text, text, text, text);
drop function if exists public.spark_qr_update(text, uuid, text, text, text, boolean);
drop function if exists public.spark_qr_delete(text, uuid);
drop function if exists public.spark_qr_analytics(text, uuid, integer);
drop function if exists public.spark_qr_overview(text, integer);

-- 3. Location-scoped RPCs.

create or replace function public.spark_qr_list(p_secret text, p_location_id text)
returns json
language plpgsql
security definer
set search_path to 'public', 'qr'
as $function$
declare v_result json;
begin
  perform qr.assert_secret(p_secret);
  select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) into v_result
  from (
    select c.id, c.slug, c.target_url, c.name, c.is_active, c.location_id, c.created_at, c.updated_at,
           coalesce(s.scans, 0) as scans, coalesce(s.scans_7d, 0) as scans_7d, s.last_scan_at
    from qr.qr_codes c
    left join lateral (
      select count(*)::int as scans,
             count(*) filter (where scanned_at >= now() - interval '7 days')::int as scans_7d,
             max(scanned_at) as last_scan_at
      from qr.qr_scans where qr_id = c.id
    ) s on true
    where c.location_id = coalesce(p_location_id, '')
  ) t;
  return v_result;
end; $function$;

create or replace function public.spark_qr_get(p_secret text, p_id uuid, p_location_id text)
returns json
language plpgsql
security definer
set search_path to 'public', 'qr'
as $function$
declare v_result json;
begin
  perform qr.assert_secret(p_secret);
  select row_to_json(c) into v_result from qr.qr_codes c
    where c.id = p_id and c.location_id = coalesce(p_location_id, '');
  if v_result is null then raise exception 'not_found'; end if;
  return v_result;
end; $function$;

create or replace function public.spark_qr_create(p_secret text, p_location_id text, p_slug text, p_target_url text, p_name text default '')
returns json
language plpgsql
security definer
set search_path to 'public', 'qr'
as $function$
declare v_id uuid;
begin
  perform qr.assert_secret(p_secret);
  if coalesce(trim(p_target_url), '') = '' then raise exception 'missing_target_url'; end if;
  if p_target_url !~* '^https?://' then raise exception 'invalid_target_url' using hint = 'target_url must start with http:// or https://'; end if;
  insert into qr.qr_codes (slug, target_url, name, location_id)
  values (p_slug, trim(p_target_url), coalesce(trim(p_name), ''), coalesce(p_location_id, ''))
  returning id into v_id;
  return public.spark_qr_get(p_secret, v_id, coalesce(p_location_id, ''));
end; $function$;

create or replace function public.spark_qr_update(p_secret text, p_id uuid, p_location_id text, p_slug text default null, p_target_url text default null, p_name text default null, p_is_active boolean default null)
returns json
language plpgsql
security definer
set search_path to 'public', 'qr'
as $function$
begin
  perform qr.assert_secret(p_secret);
  if p_target_url is not null and p_target_url !~* '^https?://' then
    raise exception 'invalid_target_url' using hint = 'target_url must start with http:// or https://';
  end if;
  update qr.qr_codes set
    slug = coalesce(p_slug, slug),
    target_url = coalesce(nullif(trim(p_target_url), ''), target_url),
    name = coalesce(p_name, name),
    is_active = coalesce(p_is_active, is_active)
  where id = p_id and location_id = coalesce(p_location_id, '');
  if not found then raise exception 'not_found'; end if;
  return public.spark_qr_get(p_secret, p_id, coalesce(p_location_id, ''));
end; $function$;

create or replace function public.spark_qr_delete(p_secret text, p_id uuid, p_location_id text)
returns json
language plpgsql
security definer
set search_path to 'public', 'qr'
as $function$
begin
  perform qr.assert_secret(p_secret);
  delete from qr.qr_codes where id = p_id and location_id = coalesce(p_location_id, '');
  if not found then raise exception 'not_found'; end if;
  return json_build_object('ok', true, 'id', p_id);
end; $function$;

create or replace function public.spark_qr_analytics(p_secret text, p_id uuid, p_location_id text, p_days integer default 30)
returns json
language plpgsql
security definer
set search_path to 'public', 'qr'
as $function$
declare v_days int := greatest(1, least(coalesce(p_days, 30), 365)); v_result json;
begin
  perform qr.assert_secret(p_secret);
  if not exists (select 1 from qr.qr_codes where id = p_id and location_id = coalesce(p_location_id, '')) then
    raise exception 'not_found';
  end if;
  select json_build_object(
    'qr', (select row_to_json(c) from qr.qr_codes c where c.id = p_id),
    'days', v_days,
    'total', (select count(*) from qr.qr_scans where qr_id = p_id),
    'in_range', (select count(*) from qr.qr_scans where qr_id = p_id and scanned_at >= now() - make_interval(days => v_days)),
    'unique_visitors', (select count(distinct ip_hash) from qr.qr_scans where qr_id = p_id and ip_hash is not null and scanned_at >= now() - make_interval(days => v_days)),
    'last_scan_at', (select max(scanned_at) from qr.qr_scans where qr_id = p_id),
    'by_day', (select coalesce(json_agg(json_build_object('day', day, 'count', count) order by day), '[]'::json) from (
        select to_char(date_trunc('day', scanned_at), 'YYYY-MM-DD') as day, count(*) as count
        from qr.qr_scans where qr_id = p_id and scanned_at >= now() - make_interval(days => v_days) group by 1) d),
    'top_countries', (select coalesce(json_agg(json_build_object('country', country, 'count', count) order by count desc), '[]'::json) from (
        select coalesce(country, '??') as country, count(*) as count from qr.qr_scans
        where qr_id = p_id and scanned_at >= now() - make_interval(days => v_days) group by 1 order by 2 desc limit 12) c),
    'top_cities', (select coalesce(json_agg(json_build_object('city', city, 'count', count) order by count desc), '[]'::json) from (
        select city, count(*) as count from qr.qr_scans
        where qr_id = p_id and city is not null and scanned_at >= now() - make_interval(days => v_days) group by 1 order by 2 desc limit 12) c)
  ) into v_result;
  return v_result;
end; $function$;

create or replace function public.spark_qr_overview(p_secret text, p_location_id text, p_days integer default 30)
returns json
language plpgsql
security definer
set search_path to 'public', 'qr'
as $function$
declare v_days int := greatest(1, least(coalesce(p_days, 30), 365)); v_loc text := coalesce(p_location_id, ''); v_result json;
begin
  perform qr.assert_secret(p_secret);
  select json_build_object(
    'days', v_days,
    'total_qrs', (select count(*) from qr.qr_codes where location_id = v_loc),
    'active_qrs', (select count(*) from qr.qr_codes where location_id = v_loc and is_active),
    'total_scans', (select count(*) from qr.qr_scans s join qr.qr_codes c on c.id = s.qr_id where c.location_id = v_loc),
    'scans_in_range', (select count(*) from qr.qr_scans s join qr.qr_codes c on c.id = s.qr_id where c.location_id = v_loc and s.scanned_at >= now() - make_interval(days => v_days)),
    'unique_in_range', (select count(distinct s.ip_hash) from qr.qr_scans s join qr.qr_codes c on c.id = s.qr_id where c.location_id = v_loc and s.ip_hash is not null and s.scanned_at >= now() - make_interval(days => v_days)),
    'by_day', (select coalesce(json_agg(json_build_object('day', day, 'count', count) order by day), '[]'::json) from (
        select to_char(date_trunc('day', s.scanned_at), 'YYYY-MM-DD') as day, count(*) as count
        from qr.qr_scans s join qr.qr_codes c on c.id = s.qr_id
        where c.location_id = v_loc and s.scanned_at >= now() - make_interval(days => v_days) group by 1) d),
    'top', (select coalesce(json_agg(row_to_json(t) order by t.scans desc), '[]'::json) from (
        select c.id, c.slug, c.name, c.is_active,
               count(s.*) filter (where s.scanned_at >= now() - make_interval(days => v_days))::int as scans
        from qr.qr_codes c left join qr.qr_scans s on s.qr_id = c.id
        where c.location_id = v_loc group by c.id order by scans desc limit 5) t)
  ) into v_result;
  return v_result;
end; $function$;

-- Lock down: these RPCs are reachable only through the service-role edge fn.
revoke all on function public.spark_qr_list(text, text) from anon, authenticated;
revoke all on function public.spark_qr_get(text, uuid, text) from anon, authenticated;
revoke all on function public.spark_qr_create(text, text, text, text, text) from anon, authenticated;
revoke all on function public.spark_qr_update(text, uuid, text, text, text, text, boolean) from anon, authenticated;
revoke all on function public.spark_qr_delete(text, uuid, text) from anon, authenticated;
revoke all on function public.spark_qr_analytics(text, uuid, text, integer) from anon, authenticated;
revoke all on function public.spark_qr_overview(text, text, integer) from anon, authenticated;

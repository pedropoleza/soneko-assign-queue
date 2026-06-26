-- Spark QR — dynamic QR codes with editable redirects + scan analytics.
-- Single-tenant. Lives in its own `qr` schema inside the GHL Token project,
-- fully isolated from the soneko.* tables. All access goes through
-- SECURITY DEFINER RPCs in `public` (prefixed spark_qr_*), mirroring the
-- soneko_* pattern, so PostgREST never needs the `qr` schema exposed.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists qr;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists qr.qr_codes (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  target_url  text not null,
  name        text not null default '',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists qr.qr_scans (
  id          uuid primary key default gen_random_uuid(),
  qr_id       uuid not null references qr.qr_codes(id) on delete cascade,
  scanned_at  timestamptz not null default now(),
  ip_hash     text,
  user_agent  text,
  country     text,
  city        text
);

create index if not exists qr_scans_qr_id_scanned_at_idx
  on qr.qr_scans (qr_id, scanned_at desc);
create index if not exists qr_scans_scanned_at_idx
  on qr.qr_scans (scanned_at desc);

-- Single-row config: holds the admin secret (gate for the panel API) and the
-- salt used to hash scan IPs. Auto-seeded with random values on first run.
create table if not exists qr.app_config (
  id            boolean primary key default true check (id),
  admin_secret  text not null,
  scan_salt     text not null,
  created_at    timestamptz not null default now()
);

insert into qr.app_config (id, admin_secret, scan_salt)
values (
  true,
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
)
on conflict (id) do nothing;

-- Reserved slugs that must never be claimed by a QR code.
create table if not exists qr.reserved_slugs (slug text primary key);

insert into qr.reserved_slugs (slug) values
  ('api'), ('admin'), ('_next'), ('favicon'), ('favicon.ico'), ('robots.txt'),
  ('sitemap.xml'), ('static'), ('assets'), ('public'), ('dashboard'), ('login'),
  ('logout'), ('auth'), ('app'), ('www'), ('root'), ('qr'), ('scan'), ('scans'),
  ('health'), ('healthz'), ('status'), ('null'), ('undefined'), ('new'), ('edit'),
  ('delete'), ('settings'), ('about'), ('terms'), ('privacy'), ('index'), ('404'),
  ('500'), ('analytics'), ('go')
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Slug normalization + validation (lowercase, regex, reserved, collision)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function qr.normalize_and_check_slug()
returns trigger
language plpgsql
as $$
begin
  new.slug := lower(trim(new.slug));

  if new.slug !~ '^[a-z0-9][a-z0-9-]{1,49}$' then
    raise exception 'invalid_slug'
      using hint = 'Use 2-50 chars: lowercase letters, digits and hyphens; must start alphanumeric.';
  end if;

  if exists (select 1 from qr.reserved_slugs r where r.slug = new.slug) then
    raise exception 'reserved_slug' using hint = format('"%s" is a reserved slug.', new.slug);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists qr_codes_slug_check on qr.qr_codes;
create trigger qr_codes_slug_check
  before insert or update on qr.qr_codes
  for each row execute function qr.normalize_and_check_slug();

-- ─────────────────────────────────────────────────────────────────────────────
-- Public RPCs — admin secret gate
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.spark_qr_check_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = public, qr
as $$
  select exists (
    select 1 from qr.app_config
    where admin_secret = p_secret and p_secret is not null and length(p_secret) > 0
  );
$$;

-- Internal guard used by every admin RPC.
create or replace function qr.assert_secret(p_secret text)
returns void
language plpgsql
security definer
set search_path = public, qr
as $$
begin
  if not public.spark_qr_check_secret(p_secret) then
    raise exception 'invalid_secret' using errcode = '42501';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Redirect path — called by the public spark-qr-redirect edge function only
-- (service role). Not granted to anon/authenticated.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.spark_qr_lookup(p_slug text)
returns json
language sql
security definer
set search_path = public, qr
as $$
  select case when c.id is null then null else
    json_build_object('id', c.id, 'target_url', c.target_url, 'name', c.name)
  end
  from (select * from qr.qr_codes where slug = lower(trim(p_slug)) and is_active limit 1) c;
$$;

create or replace function public.spark_qr_insert_scan(
  p_qr_id     uuid,
  p_ip        text default null,
  p_user_agent text default null,
  p_country   text default null,
  p_city      text default null
)
returns void
language plpgsql
security definer
set search_path = public, qr, extensions
as $$
declare
  v_salt text;
  v_hash text;
begin
  select scan_salt into v_salt from qr.app_config limit 1;

  if p_ip is not null and length(p_ip) > 0 then
    v_hash := encode(digest(p_ip || ':' || coalesce(v_salt, ''), 'sha256'), 'hex');
  end if;

  insert into qr.qr_scans (qr_id, ip_hash, user_agent, country, city)
  values (
    p_qr_id,
    v_hash,
    nullif(left(coalesce(p_user_agent, ''), 500), ''),
    nullif(upper(coalesce(p_country, '')), ''),
    nullif(p_city, '')
  );
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Admin CRUD
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.spark_qr_list(p_secret text)
returns json
language plpgsql
security definer
set search_path = public, qr
as $$
declare v_result json;
begin
  perform qr.assert_secret(p_secret);
  select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
  into v_result
  from (
    select
      c.id, c.slug, c.target_url, c.name, c.is_active, c.created_at, c.updated_at,
      coalesce(s.scans, 0)        as scans,
      coalesce(s.scans_7d, 0)     as scans_7d,
      s.last_scan_at
    from qr.qr_codes c
    left join lateral (
      select
        count(*)::int as scans,
        count(*) filter (where scanned_at >= now() - interval '7 days')::int as scans_7d,
        max(scanned_at) as last_scan_at
      from qr.qr_scans where qr_id = c.id
    ) s on true
  ) t;
  return v_result;
end;
$$;

create or replace function public.spark_qr_get(p_secret text, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public, qr
as $$
declare v_result json;
begin
  perform qr.assert_secret(p_secret);
  select row_to_json(c) into v_result from qr.qr_codes c where c.id = p_id;
  if v_result is null then raise exception 'not_found'; end if;
  return v_result;
end;
$$;

create or replace function public.spark_qr_check_slug(
  p_secret text, p_slug text, p_exclude_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, qr
as $$
declare
  v_slug text;
  v_reason text := null;
  v_available boolean := false;
begin
  perform qr.assert_secret(p_secret);
  v_slug := lower(trim(coalesce(p_slug, '')));

  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,49}$' then
    v_reason := 'invalid_format';
  elsif exists (select 1 from qr.reserved_slugs where slug = v_slug) then
    v_reason := 'reserved';
  elsif exists (
    select 1 from qr.qr_codes
    where slug = v_slug and (p_exclude_id is null or id <> p_exclude_id)
  ) then
    v_reason := 'taken';
  else
    v_available := true;
  end if;

  return json_build_object('slug', v_slug, 'available', v_available, 'reason', v_reason);
end;
$$;

create or replace function public.spark_qr_create(
  p_secret text, p_slug text, p_target_url text, p_name text default ''
)
returns json
language plpgsql
security definer
set search_path = public, qr
as $$
declare v_id uuid;
begin
  perform qr.assert_secret(p_secret);

  if coalesce(trim(p_target_url), '') = '' then
    raise exception 'missing_target_url';
  end if;
  if p_target_url !~* '^https?://' then
    raise exception 'invalid_target_url' using hint = 'target_url must start with http:// or https://';
  end if;

  insert into qr.qr_codes (slug, target_url, name)
  values (p_slug, trim(p_target_url), coalesce(trim(p_name), ''))
  returning id into v_id;

  return public.spark_qr_get(p_secret, v_id);
end;
$$;

create or replace function public.spark_qr_update(
  p_secret text,
  p_id uuid,
  p_slug text default null,
  p_target_url text default null,
  p_name text default null,
  p_is_active boolean default null
)
returns json
language plpgsql
security definer
set search_path = public, qr
as $$
begin
  perform qr.assert_secret(p_secret);

  if p_target_url is not null and p_target_url !~* '^https?://' then
    raise exception 'invalid_target_url' using hint = 'target_url must start with http:// or https://';
  end if;

  update qr.qr_codes
  set
    slug       = coalesce(p_slug, slug),
    target_url = coalesce(nullif(trim(p_target_url), ''), target_url),
    name       = coalesce(p_name, name),
    is_active  = coalesce(p_is_active, is_active)
  where id = p_id;

  if not found then raise exception 'not_found'; end if;
  return public.spark_qr_get(p_secret, p_id);
end;
$$;

create or replace function public.spark_qr_delete(p_secret text, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public, qr
as $$
begin
  perform qr.assert_secret(p_secret);
  delete from qr.qr_codes where id = p_id;
  if not found then raise exception 'not_found'; end if;
  return json_build_object('ok', true, 'id', p_id);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Analytics (per QR)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.spark_qr_analytics(
  p_secret text, p_id uuid, p_days int default 30
)
returns json
language plpgsql
security definer
set search_path = public, qr
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 30), 365));
  v_result json;
begin
  perform qr.assert_secret(p_secret);

  select json_build_object(
    'qr', (select row_to_json(c) from qr.qr_codes c where c.id = p_id),
    'days', v_days,
    'total', (select count(*) from qr.qr_scans where qr_id = p_id),
    'in_range', (
      select count(*) from qr.qr_scans
      where qr_id = p_id and scanned_at >= now() - make_interval(days => v_days)
    ),
    'unique_visitors', (
      select count(distinct ip_hash) from qr.qr_scans
      where qr_id = p_id and ip_hash is not null
        and scanned_at >= now() - make_interval(days => v_days)
    ),
    'last_scan_at', (select max(scanned_at) from qr.qr_scans where qr_id = p_id),
    'by_day', (
      select coalesce(json_agg(json_build_object('day', day, 'count', count) order by day), '[]'::json)
      from (
        select to_char(date_trunc('day', scanned_at), 'YYYY-MM-DD') as day, count(*) as count
        from qr.qr_scans
        where qr_id = p_id and scanned_at >= now() - make_interval(days => v_days)
        group by 1
      ) d
    ),
    'top_countries', (
      select coalesce(json_agg(json_build_object('country', country, 'count', count) order by count desc), '[]'::json)
      from (
        select coalesce(country, '??') as country, count(*) as count
        from qr.qr_scans
        where qr_id = p_id and scanned_at >= now() - make_interval(days => v_days)
        group by 1 order by 2 desc limit 12
      ) c
    ),
    'top_cities', (
      select coalesce(json_agg(json_build_object('city', city, 'count', count) order by count desc), '[]'::json)
      from (
        select city, count(*) as count
        from qr.qr_scans
        where qr_id = p_id and city is not null
          and scanned_at >= now() - make_interval(days => v_days)
        group by 1 order by 2 desc limit 12
      ) c
    )
  ) into v_result;

  return v_result;
end;
$$;

-- Returns the admin secret + scan salt. Only callable with service role
-- (never granted to anon). Handy for the team to fetch the generated secret.
create or replace function public.spark_qr_config()
returns json
language sql
security definer
set search_path = public, qr
as $$
  select json_build_object('admin_secret', admin_secret) from qr.app_config limit 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lock everything down: revoke from anon/authenticated. The edge functions
-- talk to these via the service role, which bypasses these grants.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function public.spark_qr_check_secret(text) from anon, authenticated;
revoke all on function public.spark_qr_lookup(text) from anon, authenticated;
revoke all on function public.spark_qr_insert_scan(uuid, text, text, text, text) from anon, authenticated;
revoke all on function public.spark_qr_list(text) from anon, authenticated;
revoke all on function public.spark_qr_get(text, uuid) from anon, authenticated;
revoke all on function public.spark_qr_check_slug(text, text, uuid) from anon, authenticated;
revoke all on function public.spark_qr_create(text, text, text, text) from anon, authenticated;
revoke all on function public.spark_qr_update(text, uuid, text, text, text, boolean) from anon, authenticated;
revoke all on function public.spark_qr_delete(text, uuid) from anon, authenticated;
revoke all on function public.spark_qr_analytics(text, uuid, int) from anon, authenticated;
revoke all on function public.spark_qr_config() from anon, authenticated;

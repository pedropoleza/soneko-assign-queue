-- Spark QR — per-QR "origin" tag for same-link attribution.
--
-- You can point several QR codes at the SAME final destination (e.g. one
-- WhatsApp number) and tag each with where it lives — a venue, a flyer, a
-- campaign. Each QR keeps its own scan metrics (by slug); the origin tag is
-- composed into the OUTBOUND redirect URL at redirect time so the destination
-- also learns the origin:
--   * WhatsApp links (wa.me / api.whatsapp.com): the tag is appended to the
--     prefilled message text — "(Origem: <tag>)".
--   * any other URL: a `source=<tag>` query param is added (which the Acelera
--     landing reads as ?source, closing the attribution loop).
-- Composition lives in the spark-qr-redirect edge function; the tag is stored
-- clean here so the base link stays editable.

alter table qr.qr_codes add column if not exists origin text not null default '';

-- lookup returns origin so the redirect can compose the outbound URL.
create or replace function public.spark_qr_lookup(p_slug text)
returns json language sql security definer set search_path to 'public', 'qr'
as $function$
  select case when c.id is null then null else
    json_build_object('id', c.id, 'target_url', c.target_url, 'name', c.name, 'origin', c.origin)
  end
  from (select * from qr.qr_codes where slug = lower(trim(p_slug)) and is_active limit 1) c;
$function$;

-- list includes origin.
create or replace function public.spark_qr_list(p_secret text, p_location_id text)
returns json language plpgsql security definer set search_path to 'public', 'qr'
as $function$
declare v_result json;
begin
  perform qr.assert_secret(p_secret);
  select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json) into v_result
  from (
    select c.id, c.slug, c.target_url, c.name, c.is_active, c.location_id, c.origin, c.created_at, c.updated_at,
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

-- create/update gain p_origin (new arg lists → drop the old signatures first).
drop function if exists public.spark_qr_create(text, text, text, text, text);
drop function if exists public.spark_qr_update(text, uuid, text, text, text, text, boolean);

create or replace function public.spark_qr_create(p_secret text, p_location_id text, p_slug text, p_target_url text, p_name text default '', p_origin text default '')
returns json language plpgsql security definer set search_path to 'public', 'qr'
as $function$
declare v_id uuid;
begin
  perform qr.assert_secret(p_secret);
  if coalesce(trim(p_target_url), '') = '' then raise exception 'missing_target_url'; end if;
  if p_target_url !~* '^https?://' then raise exception 'invalid_target_url' using hint = 'target_url must start with http:// or https://'; end if;
  insert into qr.qr_codes (slug, target_url, name, location_id, origin)
  values (p_slug, trim(p_target_url), coalesce(trim(p_name), ''), coalesce(p_location_id, ''), coalesce(trim(p_origin), ''))
  returning id into v_id;
  return public.spark_qr_get(p_secret, v_id, coalesce(p_location_id, ''));
end; $function$;

create or replace function public.spark_qr_update(p_secret text, p_id uuid, p_location_id text, p_slug text default null, p_target_url text default null, p_name text default null, p_is_active boolean default null, p_origin text default null)
returns json language plpgsql security definer set search_path to 'public', 'qr'
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
    is_active = coalesce(p_is_active, is_active),
    origin = coalesce(p_origin, origin)
  where id = p_id and location_id = coalesce(p_location_id, '');
  if not found then raise exception 'not_found'; end if;
  return public.spark_qr_get(p_secret, p_id, coalesce(p_location_id, ''));
end; $function$;

revoke all on function public.spark_qr_create(text, text, text, text, text, text) from anon, authenticated;
revoke all on function public.spark_qr_update(text, uuid, text, text, text, text, boolean, text) from anon, authenticated;

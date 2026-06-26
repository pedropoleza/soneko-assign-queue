-- Spark QR — dashboard overview RPC: aggregate stats across all QR codes.

create or replace function public.spark_qr_overview(p_secret text, p_days int default 30)
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
    'days', v_days,
    'total_qrs', (select count(*) from qr.qr_codes),
    'active_qrs', (select count(*) from qr.qr_codes where is_active),
    'total_scans', (select count(*) from qr.qr_scans),
    'scans_in_range', (
      select count(*) from qr.qr_scans
      where scanned_at >= now() - make_interval(days => v_days)
    ),
    'unique_in_range', (
      select count(distinct ip_hash) from qr.qr_scans
      where ip_hash is not null and scanned_at >= now() - make_interval(days => v_days)
    ),
    'by_day', (
      select coalesce(json_agg(json_build_object('day', day, 'count', count) order by day), '[]'::json)
      from (
        select to_char(date_trunc('day', scanned_at), 'YYYY-MM-DD') as day, count(*) as count
        from qr.qr_scans
        where scanned_at >= now() - make_interval(days => v_days)
        group by 1
      ) d
    ),
    'top', (
      select coalesce(json_agg(row_to_json(t) order by t.scans desc), '[]'::json)
      from (
        select c.id, c.slug, c.name, c.is_active,
               count(s.*) filter (where s.scanned_at >= now() - make_interval(days => v_days))::int as scans
        from qr.qr_codes c
        left join qr.qr_scans s on s.qr_id = c.id
        group by c.id
        order by scans desc
        limit 5
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.spark_qr_overview(text, int) from anon, authenticated;

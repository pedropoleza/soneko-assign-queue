-- Spark QR — default WhatsApp number per location for the QR builder.
--
-- When a client opens the panel, the WhatsApp QR builder prefills their own
-- number. An explicit override in qr.location_config wins; otherwise the admin
-- function falls back to the location's GHL phone (when the app is
-- OAuth-installed and we hold a token — see spark_qr_wa_number returning it).

create table if not exists qr.location_config (
  location_id text primary key,
  whatsapp_phone text not null default '',
  updated_at timestamptz not null default now()
);

-- Five Star Ricos → their WhatsApp number.
insert into qr.location_config (location_id, whatsapp_phone)
values ('jA6uzx6tONyTeocxw4Cj', '15616902912')
on conflict (location_id) do update set whatsapp_phone = excluded.whatsapp_phone, updated_at = now();

-- Returns the override phone (if any) + the location's GHL access token so the
-- edge function can fall back to the GHL location phone.
create or replace function public.spark_qr_wa_number(p_secret text, p_location_id text)
returns json language plpgsql security definer set search_path = public, qr as $$
declare v_phone text; v_token text;
begin
  perform qr.assert_secret(p_secret);
  select whatsapp_phone into v_phone from qr.location_config where location_id = coalesce(p_location_id, '');
  select access_token into v_token from qr.ghl_oauth where location_id = coalesce(p_location_id, '') limit 1;
  return json_build_object('phone', coalesce(v_phone, ''), 'access_token', coalesce(v_token, ''));
end; $$;
revoke all on function public.spark_qr_wa_number(text, text) from anon, authenticated;

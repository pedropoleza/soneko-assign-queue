-- IG Opportunities — admin secret + cron do reconciliador.
--
-- Gere o admin secret uma vez (não versionar o valor):
--   insert into igopps.app_config (key, value)
--   values ('admin_secret', encode(extensions.gen_random_bytes(24), 'hex'))
--   on conflict (key) do nothing;
--   select value from igopps.app_config where key = 'admin_secret';

select cron.unschedule('igopps-reconcile')
 where exists (select 1 from cron.job where jobname = 'igopps-reconcile');

-- A cada 10 minutos: o cron chama a function, que lê as conversas de Instagram
-- novas no GHL e cria as oportunidades faltantes.
select cron.schedule(
  'igopps-reconcile',
  '*/10 * * * *',
  $CRON$
    select net.http_post(
      url := 'https://tbziahcpkrfiksqhuhpe.supabase.co/functions/v1/ig-opportunities',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-igopps-admin', (select value from igopps.app_config where key = 'admin_secret')
      ),
      body := jsonb_build_object('trigger', 'cron'),
      timeout_milliseconds := 150000
    );
  $CRON$
);
